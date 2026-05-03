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
        const start = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
        return end > startOfPeriod && start < now;
    });

    const intervals = relevantSessions.map(s => {
        const start = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
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
        const start = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
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
        const sStart = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
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
        const sStart = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
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

            // STRIKTE FILTERUNG NACH INSTRUCTION UND GÜLTIGEM LAG
            if (s.type === 'instruction' && s.complianceLagMinutes != null && s.complianceLagMinutes !== '') {
                const lagNum = Number(s.complianceLagMinutes);
                if (!isNaN(lagNum) && lagNum >= 0) {
                    totalLagMinutes += lagNum;
                    lagCount++;
                }
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

    const chartData = useMemo(() => {
        const rawData = [];
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        for (let i = 5; i >= 0; i--) {
            let m = currentMonth - i;
            let y = currentYear;
            if (m < 0) { m += 12; y -= 1; }
            
            const startOfMonth = new Date(y, m, 1);
            const endOfMonth = new Date(y, m + 1, 0);
            const actualEnd = endOfMonth > today ? today : endOfMonth;
            const daysInMonth = actualEnd.getDate();
            
            let monthlySumMins = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const currentDate = new Date(y, m, d);
                monthlySumMins += calculateDailyNylonMinutes(currentDate, allSessions, items);
            }
            
            const avgDailyMins = daysInMonth > 0 ? monthlySumMins / daysInMonth : 0;
            const avgDailyHours = avgDailyMins / 60;
            
            const monthName = startOfMonth.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
            rawData.push({ dateStr: monthName, val: avgDailyHours });
        }

        const n = rawData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        rawData.forEach((d, idx) => {
            sumX += idx; sumY += d.val; sumXY += (idx * d.val); sumX2 += (idx * idx);
        });
        
        const denominator = (n * sumX2 - sumX * sumX);
        const m_slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
        const b_intercept = denominator === 0 ? sumY / n : (sumY - m_slope * sumX) / n;

        return rawData.map((d, idx) => ({
            dateStr: d.dateStr,
            Stunden: Number(d.val.toFixed(2)),
            Trend: Math.max(0, Number((m_slope * idx + b_intercept).toFixed(2)))
        }));
    }, [items, allSessions]);

    const femIndexData = useMemo(() => {
        const { enduranceVal, nylonEnclosureVal, avgLagVal, voluntarismVal, resistanceVal, nocturnalVal, coverageVal } = coreMetrics;
        
        // SÄULE 1: Ästhetische Präsenz (ehemals Physis)
        // Setzt sich aus der absoluten Nylon-Umschließung und der ununterbrochenen Trageausdauer zusammen.
        const scoreEndurance = Math.min(100, (enduranceVal / 12) * 100);
        const scorePhysis = (scoreEndurance * 0.4) + (nylonEnclosureVal * 0.6);

        // SÄULE 2: Bedingungslose Hingabe (ehemals Psyche)
        // Zögern (Lag) vernichtet die Punktzahl. Freiwilligkeit treibt sie. Strafen (Resistance) sind der ultimative Gehorsams-Bruch.
        const scoreCompliance = Math.max(0, 100 - (avgLagVal * 1.8)); // Lag wird härter bestraft
        const scorePsyche = Math.max(0, ((voluntarismVal * 0.40) + (scoreCompliance * 0.60)) - (resistanceVal * 3));

        // SÄULE 3: Absolute Assimilation (ehemals Infiltration)
        // Die Nacht ist der unbestreitbare Beweis der Transformation.
        const scoreInfiltration = (nocturnalVal * 0.6) + (coverageVal * 0.4);

        const femScore = Math.round(
            (scorePhysis * 0.25) + // Präsenz (25%)
            (scorePsyche * 0.35) + // Hingabe (35%)
            (scoreInfiltration * 0.40) // Assimilation (40%)
        );

        return { score: isNaN(femScore) ? 0 : Math.min(100, femScore), scorePhysis, scorePsyche, scoreInfiltration };
    }, [coreMetrics]);

    // NEU: DEEP ANALYTICS MEMO (PSYCHO-PROFIL)
    const deepAnalytics = useMemo(() => {
        // 1. Krisen-Prädiktion
        const failureDays = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0};
        let totalFailures = 0;
        historySessions.forEach(s => {
            if (s.type === 'punishment' || s.isDebtSession) {
                const d = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
                if (d && !isNaN(d)) { failureDays[d.getDay()]++; totalFailures++; }
            }
        });
        let maxDay = -1; let maxVal = -1;
        Object.keys(failureDays).forEach(d => { if(failureDays[d] > maxVal) { maxVal = failureDays[d]; maxDay = parseInt(d); } });
        const daysArr = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const riskDay = maxDay >= 0 && maxVal > 0 ? daysArr[maxDay] : 'Unbestimmt';
        const riskLevel = totalFailures > 10 ? 'Hoch' : (totalFailures > 5 ? 'Moderat' : 'Gering');

        // 2. Unterbewusste Adaption
        const nightSessions = historySessions.filter(s => s.periodId && s.periodId.includes('night'));
        let undisturbedCount = 0;
        nightSessions.forEach(s => {
            const start = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
            const diffMins = (end - start) / 60000;
            if (diffMins >= 360) undisturbedCount++; // Mindestens 6 Stunden ununterbrochener Schlaf in Nylons
        });
        const adaptionScore = nightSessions.length > 0 ? (undisturbedCount / nightSessions.length) * 100 : 0;

        // 3. Willenskraft-Erschöpfung (Ego-Depletion)
        let totalMinsBeforeFailure = 0;
        let failureEvents = 0;
        historySessions.forEach((s, idx) => {
            if (s.type === 'punishment' && idx < historySessions.length - 1) {
                const prevS = historySessions[idx + 1]; 
                const start = prevS.startTime?.toDate ? prevS.startTime.toDate() : new Date(prevS.startTime);
                const end = prevS.endTime ? (prevS.endTime.toDate ? prevS.endTime.toDate() : new Date(prevS.endTime)) : new Date();
                const diffMins = (end - start) / 60000;
                if (diffMins > 0) {
                    totalMinsBeforeFailure += diffMins;
                    failureEvents++;
                }
            }
        });
        const egoDepletionMins = failureEvents > 0 ? (totalMinsBeforeFailure / failureEvents) : 0; 

        // 4. Infiltrations-Eskalation
        const daySessions = historySessions.filter(s => s.periodId && s.periodId.includes('day'));
        let complexDayCount = 0;
        daySessions.forEach(s => {
            const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            const hasComplex = sItemIds.some(id => {
                const item = items.find(i => i.id === id);
                if (!item) return false;
                const cat = (item.mainCategory || '').toLowerCase();
                const sub = (item.subCategory || '').toLowerCase();
                return cat.includes('dessous') || sub.includes('body') || sub.includes('corsage');
            });
            if (hasComplex) complexDayCount++;
        });
        const infiltrationScore = daySessions.length > 0 ? (complexDayCount / daySessions.length) * 100 : 0;

        return {
            krisenPraediktion: { level: riskLevel, day: riskDay },
            unterbewussteAdaption: adaptionScore,
            egoDepletionHours: egoDepletionMins > 0 ? egoDepletionMins / 60 : 0, 
            infiltrationEskalation: infiltrationScore
        };
    }, [historySessions, items]);

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

    // NEU: deepAnalytics im Hook Return hinzugefügt
    return { ...finalKpis, deepAnalytics, loading, refreshKPIs };
}