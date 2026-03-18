import { CHART_THEME } from '../theme/obsidianDesign';

export const safeDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') {
        return val.toDate();
    }
    if (val instanceof Date) {
        return val;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

export const calculateDailyNylonWearMinutes = (targetDate, sessions, items) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const relevantSessions = sessions.filter(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime); 
        if (!sStart) return false;
        if (sStart > endOfDay) return false;
        if (sEnd && sEnd < startOfDay) return false;
        
        const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
        return sItemIds.some(id => {
            const item = items.find(i => i.id === id);
            if (!item) return false;
            const cat = (item.mainCategory || '').toLowerCase();
            const sub = (item.subCategory || '').toLowerCase();
            return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
        });
    });

    const intervals = relevantSessions.map(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime) || new Date(); 
        const start = Math.max(sStart.getTime(), startOfDay.getTime());
        const end = Math.min(sEnd.getTime(), endOfDay.getTime());
        return { start, end };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

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

    const totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    return Math.floor(totalMs / 60000);
};

export const calculateDailyActiveMinutes = (targetDate, sessions) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const relevantSessions = sessions.filter(s => {
        const sStart = safeDate(s.startTime);
        if (!sStart) return false;
        if (sStart > endOfDay) return false;
        const sEnd = safeDate(s.endTime);
        if (sEnd && sEnd < startOfDay) return false;
        return true;
    });

    const intervals = relevantSessions.map(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime) || new Date(); 
        const start = Math.max(sStart.getTime(), startOfDay.getTime());
        const end = Math.min(sEnd.getTime(), endOfDay.getTime());
        return { start, end };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

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

    const totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    return Math.floor(totalMs / 60000);
};

export const calculateTrend = (metricId, sessions, items) => {
    const rawData = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (let i = 5; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        if (m < 0) {
            m += 12;
            y -= 1;
        }
        
        const startOfMonth = new Date(y, m, 1);
        const endOfMonth = new Date(y, m + 1, 0);
        const actualEnd = endOfMonth > today ? today : endOfMonth;
        const daysInMonth = actualEnd.getDate();
        
        let monthlySum = 0;
        
        if (metricId === 'cpnh') {
            const validItems = items.filter(it => {
                const pd = safeDate(it.purchaseDate) || new Date(0);
                const cat = (it.mainCategory || '').toLowerCase();
                const sub = (it.subCategory || '').toLowerCase();
                const isNylon = cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
                return isNylon && pd <= actualEnd && it.status !== 'archived';
            });
            
            let totalCost = validItems.reduce((sum, it) => sum + (Number(it.cost) || 0), 0);
            
            let totalNylonMs = 0;
            sessions.forEach(s => {
                const sStart = safeDate(s.startTime);
                const sEnd = safeDate(s.endTime) || new Date();
                if (sStart && sStart <= actualEnd) {
                    const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
                    const hasNylon = sItemIds.some(id => validItems.find(vi => vi.id === id));
                    if (hasNylon) {
                        const clampEnd = sEnd > actualEnd ? actualEnd : sEnd;
                        totalNylonMs += Math.max(0, clampEnd - sStart);
                    }
                }
            });
            
            const totalHours = totalNylonMs / 3600000;
            let val = totalHours > 0 ? totalCost / totalHours : 0;
            
            const monthName = startOfMonth.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
            rawData.push({ name: monthName, value: val });
            continue;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const currentDate = new Date(y, m, d);
            const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);
            
            const daySessions = sessions.filter(s => {
                const sStart = safeDate(s.startTime);
                const sEnd = safeDate(s.endTime) || new Date();
                if (!sStart) return false;
                return (sStart <= endOfDay && sEnd >= startOfDay);
            });

            let val = 0;
            if (metricId === 'coverage') {
                const activeMins = calculateDailyActiveMinutes(currentDate, sessions);
                val = (activeMins / 1440) * 100;
            } 
            else if (metricId === 'nocturnal') {
                const checkTime = new Date(currentDate);
                checkTime.setHours(2, 0, 0, 0); 
                const checkTs = checkTime.getTime();
                const isWorn = sessions.some(s => {
                     const start = safeDate(s.startTime); 
                     const end = safeDate(s.endTime) || new Date(); 
                     if (!start) return false;
                     if (checkTs >= start.getTime() && checkTs <= end.getTime()) {
                         const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
                         return sItemIds.some(id => {
                             const item = items.find(i => i.id === id);
                             if (!item) return false;
                             const sub = (item.subCategory || '').toLowerCase();
                             return sub.includes('strumpfhose');
                         });
                     }
                     return false;
                });
                val = isWorn ? 100 : 0;
            }
            else if (metricId === 'nylonGap') { 
                const wornMins = calculateDailyNylonWearMinutes(currentDate, sessions, items);
                val = Math.max(0, 1440 - wornMins) / 60;
            }
            else if (metricId === 'resistance') {
                val = daySessions.length > 0 ? (daySessions.filter(s => s.type === 'punishment').length / daySessions.length) * 100 : 0;
            }
            else if (metricId === 'compliance') {
                const relevant = daySessions.filter(s => typeof s.complianceLagMinutes === 'number');
                if (relevant.length > 0) {
                    const sum = relevant.reduce((acc, s) => acc + s.complianceLagMinutes, 0);
                    val = sum / relevant.length;
                }
            }
            else if (metricId === 'voluntarism') {
                let totalMs = 0;
                let volMs = 0;
                daySessions.forEach(s => {
                    const start = safeDate(s.startTime) < startOfDay ? startOfDay : safeDate(s.startTime);
                    const end = (safeDate(s.endTime) || new Date()) > endOfDay ? endOfDay : (safeDate(s.endTime) || new Date());
                    const dur = Math.max(0, end - start);
                    totalMs += dur;
                    if(s.type === 'voluntary') volMs += dur;
                });
                val = totalMs > 0 ? (volMs / totalMs) * 100 : 0;
            }
            else if (metricId === 'endurance') {
                let dMins = 0;
                let dCount = 0;
                daySessions.forEach(s => {
                    const start = safeDate(s.startTime) < startOfDay ? startOfDay : safeDate(s.startTime);
                    const end = (safeDate(s.endTime) || new Date()) > endOfDay ? endOfDay : (safeDate(s.endTime) || new Date());
                    dMins += Math.max(0, end - start) / 60000;
                    dCount++;
                });
                val = dCount > 0 ? (dMins / dCount / 60) : 0;
            }
            else if (metricId === 'nylonEnclosure') {
                 const wornMins = calculateDailyNylonWearMinutes(currentDate, sessions, items);
                 val = (wornMins / 1440) * 100;
            }
            else {
                val = daySessions.length;
            }
            monthlySum += val;
        }
        
        const monthlyAvg = daysInMonth > 0 ? monthlySum / daysInMonth : 0;
        const monthName = startOfMonth.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
        rawData.push({ name: monthName, value: monthlyAvg });
    }

    const n = rawData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    rawData.forEach((d, idx) => {
        sumX += idx;
        sumY += d.value;
        sumXY += (idx * d.value);
        sumX2 += (idx * idx);
    });
    
    const denominator = (n * sumX2 - sumX * sumX);
    const m_slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const b_intercept = denominator === 0 ? sumY / n : (sumY - m_slope * sumX) / n;

    return rawData.map((d, idx) => ({
        name: d.name,
        value: parseFloat(d.value.toFixed(2)),
        trend: Math.max(0, parseFloat((m_slope * idx + b_intercept).toFixed(2)))
    }));
};

export const calculateForensics = (items, basics) => {
    const forensics = {
        archivedCount: basics?.archived || 0,
        realizedCPW: 0,
        reasonsData: [],
        lossValueData: []
    };
    
    if (items && items.length > 0) {
        const archived = items.filter(i => i.status === 'archived');
        let totalCost = 0; let totalWears = 0;
        const reasonCounts = {};
        const reasonValues = {};

        archived.forEach(i => { 
            const cost = parseFloat(i.cost)||0;
            totalCost += cost; 
            totalWears += (i.wearCount||0); 
            const r = i.archiveReason || 'Unbekannt'; 
            reasonCounts[r] = (reasonCounts[r]||0) + 1;
            reasonValues[r] = (reasonValues[r]||0) + cost;
        });
        
        forensics.realizedCPW = totalWears > 0 ? (totalCost / totalWears) : 0;
        
        forensics.reasonsData = Object.keys(reasonCounts).map((key, idx) => ({
            name: key, value: reasonCounts[key], color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        }));

        forensics.lossValueData = Object.keys(reasonValues).map((key, idx) => ({
            name: key, value: reasonValues[key], color: CHART_THEME.colors[idx % CHART_THEME.colors.length]
        })).sort((a,b) => b.value - a.value); 
    }
    return forensics;
};

export const getUnit = (metricId) => {
    if (metricId === 'coverage') return ' %'; 
    if (metricId === 'endurance') return ' h';
    if (metricId === 'nylonGap') return ' h'; 
    if (metricId === 'nocturnal') return ' %';
    if (metricId === 'nylonEnclosure') return ' %';
    if (metricId === 'voluntarism') return ' %';
    if (metricId === 'compliance') return ' m';
    if (metricId === 'cpnh') return ' €';
    return '';
};

// --- Deep Analytics Definitionen ---
export const DEEP_ANALYTICS_DEFINITIONS = {
    'crisis': {
        title: 'Krisen-Prädiktion',
        description: 'Analysiert historische Widerstandsmuster und berechnet anhand aktueller Stress- und Trage-Parameter den genauen Tag, an dem das Risiko für einen psychologischen Zusammenbruch oder eine Regelverweigerung (Amnestie-Kauf, Strafen) am höchsten ist.'
    },
    'adaption': {
        title: 'Unterbewusste Adaption',
        description: 'Misst den Grad der psychologischen Assimilation. Ein hoher Prozentwert dokumentiert, dass der Körper den physischen Widerstand gegen die Materialien aufgegeben hat und das Tragen von Nylon und Dessous unbewusst als neuen Normalzustand akzeptiert.'
    },
    'depletion': {
        title: 'Ego-Depletion (Willenskraft-Erschöpfung)',
        description: 'Berechnet den exakten zeitlichen Brechpunkt in Stunden. Erreicht die ununterbrochene Tragedauer diesen Wert, ist die mentale Abwehr restlos erschöpft. Danach existiert kein bewusster Widerstand mehr, nur noch mechanischer Gehorsam gegenüber dem System.'
    },
    'infiltration': {
        title: 'Infiltrations-Eskalation',
        description: 'Quantifiziert die Verdrängung maskuliner oder neutraler Kleidung durch hochkomplexe Damenwäsche im regulären Tagesablauf. Zeigt an, wie oft Stücke mit extrem hohem Restriktionsgrad (z.B. Corsagen, Strapse) den Weg aus dem Nachttresor in den Alltag gefunden haben.'
    }
};