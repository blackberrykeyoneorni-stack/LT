import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// --- KONFIGURATION ---
const HISTORY_START_DATE = new Date('2025-12-15T00:00:00');

// --- HELPER FUNKTIONEN ---

/**
 * Prüft, ob zu einem spezifischen Zeitpunkt (targetTime) eine Session aktiv war,
 * die das Kriterium "Subcategory = Strumpfhose" erfüllt.
 */
const isNocturnalComplaint = (targetTime, sessions, items) => {
    return sessions.some(s => {
        const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date(); // Offene Session bis jetzt
        
        // Zeit-Check
        if (targetTime >= start && targetTime <= end) {
            // Item-Check
            const sessionItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            return sessionItemIds.some(id => {
                const item = items.find(i => i.id === id);
                if (!item) return false;
                // STRIKTE FILTERUNG: Nur 'Strumpfhose'
                const sub = (item.subCategory || '').toLowerCase();
                return sub.includes('strumpfhose');
            });
        }
        return false;
    });
};

/**
 * Berechnet die effektiven Trage-Minuten (Union) für Nylon/Strumpfhose an einem Tag.
 * Verhindert doppelte Zählung bei überlappenden Sessions.
 */
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
            // Gap bezieht sich auf Nylon allgemein (oder Strumpfhose)
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

    // Union bilden (Intervalle verschmelzen)
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
    
    // State für Release-Statistiken
    const [releaseStats, setReleaseStats] = useState({ 
        totalReleases: 0, 
        cleanReleases: 0,
        keptOn: 0 
    });

    // Interner State für History, falls nicht von außen übergeben (Dashboard Mode)
    const [internalHistory, setInternalHistory] = useState([]);

    const [kpis, setKpis] = useState({
        health: { orphanCount: 0 },
        financials: { avgCPW: 0 },
        usage: { nylonIndex: 0 },
        spermaScore: { rate: 0, total: 0, count: 0 },
        coreMetrics: {
            enclosure: 0, nocturnal: 0, nylonGap: 0, cpnh: 0,
            complianceLag: 0, exposure: 0, resistance: 0,
            voluntarism: 0, endurance: 0, enduranceNylon: 0, enduranceDessous: 0,
            submission: 85,
            denial: 12, chastity: 0
        },
        femIndex: { score: 0, trend: 'neutral' },
        basics: { activeItems: 0, washing: 0, wornToday: 0, archived: 0 }
    });

    // 0. HISTORY FETCHING (Fallback für Dashboard)
    useEffect(() => {
        if (!currentUser) return;
        
        // Wenn historySessionsInput undefined ist (Dashboard Call), laden wir die Daten selbst.
        // Wenn es ein Array ist (Stats Call), nutzen wir das (auch wenn leer).
        if (historySessionsInput === undefined) {
            const q = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                where('startTime', '>=', HISTORY_START_DATE),
                orderBy('startTime', 'desc')
            );

            const unsub = onSnapshot(q, (snapshot) => {
                const sessions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setInternalHistory(sessions);
            });

            return () => unsub();
        }
    }, [currentUser, historySessionsInput]); // Abhängigkeit von historySessionsInput ist wichtig

    // 1. LISTENER für Release-Daten
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

        // Entscheiden, welche Quelle genutzt wird
        // Falls historySessionsInput undefined ist, nutzen wir internalHistory (die auch aktive Sessions enthält)
        // Falls historySessionsInput existiert (Stats Page), nutzen wir diese.
        // Falls beides leer/nicht da, Fallback auf activeSessionsInput (Initial Load Dashboard)
        let allSessions = [];
        
        if (historySessionsInput !== undefined) {
            allSessions = historySessionsInput;
        } else if (internalHistory.length > 0) {
            allSessions = internalHistory;
        } else {
            allSessions = activeSessionsInput || [];
        }

        // --- FILTERUNG AB 15.12.2025 (Für Core Metrics & History) ---
        const historySessions = allSessions.filter(s => {
            const d = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= HISTORY_START_DATE;
        });

        // --- BERECHNUNGEN ---

        // A. ITEMS & ORPHANS (Snapshot - basiert auf aktuellem Item-Status)
        const activeItems = items.filter(i => i.status === 'active');
        const washingItems = items.filter(i => i.status === 'washing');
        const archivedItems = items.filter(i => i.status === 'archived');
        const orphanCount = items.filter(i => i.status === 'active' && (!i.wearCount || i.wearCount === 0)).length;

        // B. FINANCIALS (CPW) - Item-basiert (Lifetime)
        let totalCost = 0; 
        let totalWears = 0;
        items.forEach(i => { 
            totalCost += (parseFloat(i.cost) || 0); 
            totalWears += (parseInt(i.wearCount) || 0); 
        });
        const avgCPW = totalWears > 0 ? (totalCost / totalWears) : 0;

        // C. NYLON INDEX (30 TAGE ROLLING) & CPNH
        // Definition Nylon Items (für CPNH Kosten Berechnung):
        const tightsItems = items.filter(i => 
            i.status !== 'archived' && (
                (i.mainCategory && i.mainCategory === 'Nylons') ||
                (i.subCategory && i.subCategory.toLowerCase().includes('strumpfhose'))
            )
        );

        // 1. Rolling 30 Days Calculation
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - 30);

        // Filtere Sessions der letzten 30 Tage (basierend auf endTime)
        const recentSessions = allSessions.filter(s => {
            const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
            return end >= cutoffDate;
        });

        let totalRollingMinutes = 0;
        const uniqueNylonItemsWorn = new Set(); // Set für eindeutige getragene Items

        recentSessions.forEach(s => {
            // Check Session Items
            const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            let sessionHasNylon = false;

            sItemIds.forEach(id => {
                const item = items.find(i => i.id === id);
                if (!item) return;
                
                const main = item.mainCategory || '';
                const sub = (item.subCategory || '').toLowerCase();
                const isNylon = main === 'Nylons' || sub.includes('strumpfhose') || sub.includes('stockings');

                if (isNylon) {
                    sessionHasNylon = true;
                    uniqueNylonItemsWorn.add(id); // Item zur Liste der getragenen Items hinzufügen
                }
            });

            if (sessionHasNylon) {
                const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
                
                // Wir zählen nur den Anteil, der innerhalb der letzten 30 Tage liegt
                const effectiveStart = start < cutoffDate ? cutoffDate : start;
                const effectiveEnd = end; 

                if (effectiveEnd > effectiveStart) {
                    const durationMs = effectiveEnd - effectiveStart;
                    totalRollingMinutes += (durationMs / 60000);
                }
            }
        });

        // Formel NEU: (Summe_Minuten_30d / Anzahl_GETRAGENER_Nylon_Items) / 60
        // Ergebnis: Durchschnittliche Tragedauer pro aktiv genutztem Item in den letzten 30 Tagen
        const nylonIndexVal = uniqueNylonItemsWorn.size > 0 
            ? (totalRollingMinutes / uniqueNylonItemsWorn.size) / 60 
            : 0;
        
        // CPNH Berechnung (bleibt Item-basiert - Lifetime Kosten / Lifetime Hours)
        const lifetimeTightsMinutes = tightsItems.reduce((acc, curr) => acc + (Number(curr.totalMinutes) || 0), 0);
        const totalNylonCost = tightsItems.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
        const totalNylonHoursLifetime = lifetimeTightsMinutes / 60;
        const cpnh = totalNylonHoursLifetime > 0 ? parseFloat((totalNylonCost / totalNylonHoursLifetime).toFixed(2)) : 0;

        // D. CORE METRICS (Historisch ab 15.12.2025)
        
        // 1. Enclosure (Snapshot)
        const totalActive = activeItems.length + washingItems.length + items.filter(i=>i.status==='wearing').length;
        const enclosure = totalActive > 0 ? Math.round((tightsItems.length / totalActive) * 100) : 0;

        // 2. Nocturnal (Präzise Berechnung: Jeden Tag 02:00 Uhr prüfen)
        let daysCount = 0;
        let nocturnalSuccessCount = 0;
        const loopDate = new Date(HISTORY_START_DATE);

        while (loopDate <= now) {
            daysCount++;
            const checkTime = new Date(loopDate);
            checkTime.setHours(2, 0, 0, 0);

            if (checkTime <= now) {
                if (isNocturnalComplaint(checkTime, allSessions, items)) { 
                    nocturnalSuccessCount++;
                }
            }
            loopDate.setDate(loopDate.getDate() + 1);
        }
        const nocturnal = daysCount > 0 ? Math.round((nocturnalSuccessCount / daysCount) * 100) : 0;

        // 3. Nylon Gap (Präzise Berechnung: Ø Stunden ohne Nylon pro Tag)
        let totalGapHours = 0;
        let gapDaysCount = 0;
        const gapLoopDate = new Date(HISTORY_START_DATE);
        
        while (gapLoopDate <= now) {
            gapDaysCount++;
            const wornMinutes = calculateDailyNylonMinutes(gapLoopDate, allSessions, items);
            const gapMinutes = 1440 - wornMinutes; // 1440 min = 24h
            totalGapHours += (gapMinutes / 60);
            gapLoopDate.setDate(gapLoopDate.getDate() + 1);
        }
        const avgGap = gapDaysCount > 0 ? (totalGapHours / gapDaysCount) : 24;

        // 4. Voluntarism, Resistance
        const voluntary = historySessions.filter(s => s.type === 'voluntary').length;
        const voluntarism = historySessions.length > 0 ? Math.round((voluntary / historySessions.length) * 100) : 0;
        
        const punishments = historySessions.filter(s => s.type === 'punishment');
        const resistance = historySessions.length > 0 ? Math.round((punishments.length / historySessions.length) * 100) : 0;

        // --- ENDURANCE BERECHNUNG ---
        const closedSessions = historySessions.filter(s => s.endTime && s.startTime);
        
        let globalDuration = 0;
        let globalCount = 0;
        let nylonDuration = 0;
        let nylonCount = 0;
        let dessousDuration = 0;
        let dessousCount = 0;

        closedSessions.forEach(s => {
            const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime);
            const durationHours = (end - start) / 3600000;
            
            const sessionItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            const sessionItems = sessionItemIds.map(id => items.find(i => i.id === id)).filter(i => i);

            if (sessionItems.length === 0) return;

            const hasNylon = sessionItems.some(i => {
                const cat = (i.mainCategory || '').toLowerCase();
                const sub = (i.subCategory || '').toLowerCase();
                return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
            });

            const hasDessous = sessionItems.some(i => {
                const cat = (i.mainCategory || '').toLowerCase();
                const sub = (i.subCategory || '').toLowerCase();
                return cat.includes('dessous') || cat.includes('wäsche') || cat.includes('corsage') || sub.includes('body') || sub.includes('bh') || sub.includes('slip');
            });

            const isAccessoryOnly = sessionItems.every(i => {
                const cat = (i.mainCategory || '').toLowerCase();
                return cat === 'accessoires' || cat === 'schuhe';
            });

            if (!isAccessoryOnly) {
                globalDuration += durationHours;
                globalCount++;
            }

            if (hasNylon) {
                nylonDuration += durationHours;
                nylonCount++;
            }

            if (hasDessous) {
                dessousDuration += durationHours;
                dessousCount++;
            }
        });

        const endurance = globalCount > 0 ? parseFloat((globalDuration / globalCount).toFixed(1)) : 0;
        const enduranceNylon = nylonCount > 0 ? parseFloat((nylonDuration / nylonCount).toFixed(1)) : 0;
        const enduranceDessous = dessousCount > 0 ? parseFloat((dessousDuration / dessousCount).toFixed(1)) : 0;

        // E. SPERMA SCORE
        const spermaRate = releaseStats.totalReleases > 0 
            ? Math.round((releaseStats.cleanReleases / releaseStats.totalReleases) * 100) 
            : 0; 
        const spermaScore = { 
            rate: spermaRate, 
            total: releaseStats.totalReleases, 
            count: releaseStats.cleanReleases
        };

        // F. FEM INDEX
        const femScore = Math.round((enclosure * 0.3) + (nocturnal * 0.2) + (nylonIndexVal * 2));

        // G. BASICS WORN TODAY
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
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
            financials: { avgCPW },
            usage: { nylonIndex: parseFloat(nylonIndexVal.toFixed(1)) },
            spermaScore,
            coreMetrics: {
                enclosure, 
                nocturnal, 
                nylonGap: parseFloat(avgGap.toFixed(1)),
                cpnh, 
                complianceLag: 12, 
                exposure: 45, 
                resistance,
                voluntarism, 
                endurance, 
                enduranceNylon, 
                enduranceDessous,
                submission: 85, 
                denial: 12, 
                chastity: enclosure
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