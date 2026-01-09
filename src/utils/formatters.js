// src/utils/formatters.js

// Formatiert Minuten in "Xh Ym" (z.B. 95 -> "1h 35m")
export const formatDuration = (totalMinutes) => {
    if (typeof totalMinutes !== 'number' || totalMinutes < 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Formatiert Währung einheitlich (z.B. "12.50 €")
export const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return '- €';
    return `${amount.toFixed(2)} €`;
};

// Formatiert Datum für Deutschland (z.B. "19.12.2025")
export const formatDate = (date) => {
    if (!date) return '-';
    // Falls Firestore Timestamp übergeben wird, in Date wandeln
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

// Formatiert Uhrzeit (z.B. "14:30")
export const formatTime = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('de-DE', {
        hour: '2-digit', 
        minute: '2-digit'
    });
};
