/**
 * Konvertiert verschiedene Datumsformate sicher in ein JavaScript Date-Objekt.
 * Verhindert Abstürze durch null/undefined Werte oder Firestore Timestamp Inkompatibilität.
 * * @param {any} value - Der Wert aus Firestore (Timestamp, Date, String, null)
 * @returns {Date|null} - Ein gültiges Date-Objekt oder null
 */
export const safeDate = (value) => {
    if (!value) return null;

    // Fall 1: Es ist bereits ein Firestore Timestamp (hat .toDate())
    if (value && typeof value.toDate === 'function') {
        return value.toDate();
    }

    // Fall 2: Es ist bereits ein JS Date Objekt
    if (value instanceof Date) {
        return value;
    }

    // Fall 3: Es ist ein String oder eine Zahl (Timestamp millis)
    const parsed = new Date(value);
    
    // Prüfung auf "Invalid Date"
    if (isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

/**
 * Formatiert ein Datum sicher in einen String (z.B. für Inputs oder Anzeige)
 * @param {any} value 
 * @returns {string} - "TT.MM.JJJJ" oder "N/A"
 */
export const formatDateDisplay = (value) => {
    const date = safeDate(value);
    if (!date) return 'N/A';
    return date.toLocaleDateString('de-DE');
};
