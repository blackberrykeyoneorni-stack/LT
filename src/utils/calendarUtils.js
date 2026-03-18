// --- HILFSFUNKTIONEN ---

export const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag als Wochenstart
    return new Date(d.setDate(diff));
};

export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const isSameDay = (d1, d2) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
};

export const formatDuration = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h ${m < 10 ? '0'+m : m}m`;
};

export const getSuspensionForDate = (date, suspensions) => {
    if (!suspensions || suspensions.length === 0) return null;
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0); 

    return suspensions.find(s => {
        const start = new Date(s.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(s.endDate);
        end.setHours(23, 59, 59, 999);
        return checkDate >= start && checkDate <= end;
    });
};

// --- LOGIK: ZEITEN VERSCHMELZEN ---
export const calculateEffectiveMinutes = (sessions) => {
    if (!sessions || sessions.length === 0) return 0;
    const intervals = sessions.map(s => {
        const start = s.date.getTime();
        const durationMs = (s.duration || 0) * 60000;
        return { start, end: start + durationMs };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;
    intervals.sort((a, b) => a.start - b.start);

    const merged = [];
    let current = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];
        if (next.start < current.end) {
            current.end = Math.max(current.end, next.end);
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    const totalMs = merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
    return Math.floor(totalMs / 60000);
};

// Hilfsfunktion für Kalenderwoche
export function getKw(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}