import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';

// Speichert einen Release in der Historie und aktualisiert Statistiken
// outcome: 'clean' (consumed), 'ruined' (textile), 'waste' (tissue/other - fallback)
export const registerRelease = async (uid, resultType, intensity, outcome = 'clean') => {
    try {
        // 1. Session Log Eintrag
        await addDoc(collection(db, `users/${uid}/history`), {
            type: 'release',
            result: resultType, // 'maintained' or 'ruined' (session context)
            outcome: outcome,   // 'clean' vs 'ruined' (physical context)
            intensity: intensity,
            timestamp: serverTimestamp()
        });

        // 2. Statistiken Update
        const statsRef = doc(db, `users/${uid}/stats/releaseStats`);
        const statsSnap = await getDoc(statsRef);

        if (statsSnap.exists()) {
            const updates = {
                totalReleases: increment(1),
                lastRelease: serverTimestamp()
            };
            
            if (resultType === 'maintained') {
                updates.keptOn = increment(1);
            } else {
                updates.failed = increment(1);
            }

            // Outcome Tracking
            if (outcome === 'clean') updates.cleanReleases = increment(1);
            if (outcome === 'ruined') updates.ruinedItems = increment(1);

            await updateDoc(statsRef, updates);
        } else {
            // Initiale Erstellung falls nicht vorhanden
            await setDoc(statsRef, {
                totalReleases: 1,
                keptOn: resultType === 'maintained' ? 1 : 0,
                failed: resultType !== 'maintained' ? 1 : 0,
                cleanReleases: outcome === 'clean' ? 1 : 0,
                ruinedItems: outcome === 'ruined' ? 1 : 0,
                lastRelease: serverTimestamp()
            });
        }

        return true;
    } catch (e) {
        console.error("Error registering release:", e);
        throw e;
    }
};