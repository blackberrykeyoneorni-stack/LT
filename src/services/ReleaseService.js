import { db } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

/**
 * Registriert einen Release-Vorgang (Höhepunkt oder Verweigert).
 * Diese Funktion wird vom TZD-Overlay und dem Release-Dialog genutzt.
 * * @param {string} userId - Die UID des Nutzers
 * @param {string} outcome - Ergebnis ('maintained', 'ruined', 'cum_kept', 'tzd_force_end')
 * @param {number} intensity - Intensität (1-10)
 */
export const registerRelease = async (userId, outcome, intensity) => {
    if (!userId) {
        console.warn("ReleaseService: User ID fehlt, speichere unter 'unknown'");
        return; // Oder Fehler werfen, verhindert aber Absturz
    }

    // Statistiken aktualisieren
    try {
        const statsRef = doc(db, `users/${userId}/stats/releaseStats`);
        
        const isOrgasm = outcome !== 'maintained';
        const keptOn = outcome === 'cum_kept';

        await setDoc(statsRef, {
            totalReleases: increment(isOrgasm ? 1 : 0),
            keptOn: increment(keptOn ? 1 : 0),
            lastRelease: serverTimestamp(),
            lastOutcome: outcome
        }, { merge: true });

        console.log(`Release registriert: ${outcome} für ${userId}`);
        return true;
    } catch (e) {
        console.error("Fehler im ReleaseService:", e);
        throw e;
    }
};

// ALIAS: Für Abwärtskompatibilität
export const registerReleaseSuccess = registerRelease;

// ALIAS: Für useSessionProgress Hook (Fix für Build Error)
export const checkReleaseOutcome = registerRelease;