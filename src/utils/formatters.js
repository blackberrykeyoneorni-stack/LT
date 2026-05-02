// src/utils/formatters.js

// --- EBENE 1 & 2: DER GLOBALE SANITIZER ---
// Fängt null, undefined, Strings wie "NaN" und mathematisches NaN kompromisslos ab.
export const parseSafeNumber = (val, fallback = 0) => {
    if (val === null || val === undefined || val === '') return fallback;
    const parsed = Number(val);
    return Number.isNaN(parsed) ? fallback : parsed;
};

// Formatiert Minuten in "Xh Ym" (z.B. 95 -> "1h 35m")
export const formatDuration = (rawMinutes) => {
    const totalMinutes = parseSafeNumber(rawMinutes, 0);
    if (totalMinutes <= 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Formatiert Währung einheitlich (z.B. "12.50 €")
export const formatCurrency = (rawAmount) => {
    const amount = parseSafeNumber(rawAmount, 0);
    return `${amount.toFixed(2)} €`;
};

// Formatiert Datum für Deutschland (z.B. "19.12.2025")
export const formatDate = (date) => {
    if (!date) return '-';
    try {
        // Falls Firestore Timestamp übergeben wird, in Date wandeln
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return '-'; // Schutz vor ungültigen Datums-Objekten
        return d.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return '-';
    }
};

// Formatiert Uhrzeit (z.B. "14:30")
export const formatTime = (date) => {
    if (!date) return '';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('de-DE', {
            hour: '2-digit', 
            minute: '2-digit'
        });
    } catch (e) {
        return '';
    }
};

// Generiert eine Begrüßung basierend auf der Uhrzeit
export const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Gute Nacht';
    if (hour < 11) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
};