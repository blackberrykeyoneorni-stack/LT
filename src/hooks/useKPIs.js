import { useState, useEffect } from 'react';
import { doc, getDocs, getDoc, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// --- KONFIGURATION ---
const HISTORY_START_DATE = new Date('2025-12-15T00:00:00');

// --- HELPER FUNKTIONEN ---

const fmtPct = (val) => (typeof val === 'number' && !isNaN(val) ? val.toFixed(1) : '0.0');
const fmtMoney = (val) => (typeof val === 'number' && !isNaN(val) ? val.toFixed(2) : '0.00');

// Formatierung: Stunden & Minuten
const fmtDuration = (minutes) => {
    if (typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) return '0m';
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

/**
 * useKPIs Hook
 * FIX: 'export default function' hinzugefügt, damit der Import im Dashboard funktioniert.
 */
export default function useKPIs(items = [], activeSessionsInput, historySessionsInput) {
    const { currentUser } = useAuth();
    
    // Manueller Trigger & Loading State
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);

    // Initialer State
    const [kpis, setKpis] = useState({
        health: { orphanCount: 0 },
        financials: { avgCPW: '0.00' },
        usage: { nylonIndex: '0.0' },
        spermaScore: { rate: '0.0', total: 0, count: 0 },
        coreMetrics: {
            nylonEnclosure: '0.0', 
            nocturnal: '0.0', 
            nylonGap: '0m', 
            cpnh: '0.00',
            complianceLag: '0m', 
            coverage: '0.0',
            resistance: '0.0',
            voluntarism: '0.0%',
            endurance: '0m',
            enduranceNylon: '0m', 
            enduranceDessous: '0m',
            submission: '85.0',
            denial: '12.0', 
            chastity: '0.0'
        },
        femIndex: { score: 0, trend: 'neutral', subScores: { physis: 0, psyche: 0, infiltration: 0 } },
        basics: { activeItems: 0, washing: 0, wornToday: 0, archived: 0 }
    });

    useEffect(() => {
        if (!currentUser) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. SESSIONS LADEN (Einmalig per getDocs)
                let allSessions = [];
                
                if (historySessionsInput) {
                    allSessions = [...historySessionsInput, ...(activeSessionsInput || [])];
                } else {
                    const q = query(
                        collection(db, `users/${currentUser.uid}/sessions`),
                        where('startTime', '>=', HISTORY_START_DATE),
                        orderBy('startTime', 'desc')
                    );
                    const snapshot = await getDocs(q);
                    allSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }

                // 2. RELEASE STATS LADEN
                let releaseStats = { totalReleases: 0, cleanReleases: 0, keptOn: 0 };
                try {
                    const statsRef = doc(db, `users/${currentUser.uid}/stats/releaseStats`);
                    const statsSnap = await getDoc(statsRef);
                    if (statsSnap.exists()) {
                        const data = statsSnap.data();
                        releaseStats = {
                            totalReleases: Number(data.totalReleases) || 0,
                            cleanReleases: Number(data.cleanReleases) || 0,
                            keptOn: Number(data.keptOn) || 0
                        };
                    }
                } catch (e) {
                    console.warn("Release stats konnten nicht geladen werden", e);
                }

                // --- BERECHNUNGSLOGIK ---
                
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
                        (i.subCategory && i.subCategory && i.subCategory.toLowerCase().includes('strumpfhose'))
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
                
                // Variablen für Compliance Fix
                let totalLagMinutes = 0;
                let lagCount = 0;

                historySessions.forEach(s => {
                    const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                    const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
                    const duration = Math.max(0, end.getTime() - start.getTime());
                    totalDurationMs += duration;
                    if (s.type === 'voluntary') voluntaryDurationMs += duration;

                    // FIX: Robuste Berechnung für Compliance Lag
                    // Wir erzwingen eine Zahl und filtern ungültige Werte/Strings
                    const rawLag = s.complianceLagMinutes;
                    const lagNum = Number(rawLag);
                    
                    if (!isNaN(lagNum) && lagNum >= 0) {
                        totalLagMinutes += lagNum;
                        lagCount++;
                    }
                });
                
                const voluntarismVal = totalDurationMs > 0 ? (voluntaryDurationMs / totalDurationMs) * 100 : 0;
                const resistanceVal = historySessions.length > 0 ? (historySessions.filter(s => s.type === 'punishment').length / historySessions.length) * 100 : 0;
                
                // Durchschnitt berechnen (sicher vor Division durch 0)
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

                // F. FEM INDEX 3.0 (Erosion Metric)
                
                // 1. PHYSIS (30%) - Körperliche Gewöhnung
                const scoreEndurance = Math.min(100, (enduranceVal / 12) * 100);
                const scorePhysis = (scoreEndurance * 0.4) + (nylonEnclosureVal * 0.6);

                // 2. PSYCHE (30%) - Mentaler Widerstand
                // Score Compliance: 0min lag = 100 Pkt. Pro Minute Abzug.
                // Wir nutzen hier avgLagVal, das nun garantiert eine Zahl ist (oder 0).
                const scoreCompliance = Math.max(0, 100 - (avgLagVal * 1.6));
                const scorePsyche = Math.max(0, ((voluntarismVal * 0.6) + (scoreCompliance * 0.4)) - (resistanceVal * 2));

                // 3. INFILTRATION (40%) - Alltags-Übernahme
                const scoreInfiltration = (nocturnalVal * 0.5) + (coverageVal * 0.5);

                // TOTAL SCORE
                const femScore = Math.round(
                    (scorePhysis * 0.30) + 
                    (scorePsyche * 0.30) + 
                    (scoreInfiltration * 0.40)
                );

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

                // --- SET STATE ---
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
                        nylonGap: fmtHoursToDuration(avgGapVal), 
                        cpnh: fmtMoney(cpnhVal),
                        complianceLag: fmtDuration(avgLagVal), 
                        coverage: fmtPct(coverageVal),
                        resistance: fmtPct(resistanceVal),
                        voluntarism: fmtPct(voluntarismVal) + '%', 
                        endurance: fmtHoursToDuration(enduranceVal), 
                        enduranceNylon: fmtHoursToDuration(enduranceNylonVal), 
                        enduranceDessous: fmtHoursToDuration(enduranceDessousVal), 
                        submission: '85.0',
                        denial: '12.0',
                        chastity: fmtPct(nylonEnclosureVal)
                    },
                    femIndex: { 
                        score: isNaN(femScore) ? 0 : Math.min(100, femScore), // Letztes Sicherheitsnetz
                        trend: 'stable',
                        subScores: {
                            physis: Math.round(scorePhysis),
                            psyche: Math.round(scorePsyche),
                            infiltration: Math.round(scoreInfiltration)
                        }
                    },
                    basics: {
                        activeItems: activeItems.length,
                        washing: washingItems.length,
                        wornToday: uniqueItemsToday.size,
                        archived: archivedItems.length
                    }
                });
            } catch (err) {
                console.error("Error fetching KPIs:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

    }, [items, activeSessionsInput, historySessionsInput, currentUser, refreshTrigger]);

    // Exponiere die Refresh-Funktion für manuelle Updates
    const refreshKPIs = () => setRefreshTrigger(prev => prev + 1);

    return { ...kpis, loading, refreshKPIs };
}