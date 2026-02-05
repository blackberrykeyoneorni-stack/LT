import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

/**
 * Lädt das aktuelle Guthaben.
 */
export const getTimeBankBalance = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            // Initiale Erstellung
            const initialData = { nc: 0, lc: 0, updatedAt: serverTimestamp() };
            await setDoc(docRef, initialData);
            return initialData;
        }
    } catch (e) {
        console.error("Error loading TimeBank:", e);
        return { nc: 0, lc: 0 };
    }
};

/**
 * Zieht Credits ab (Spending).
 */
export const spendCredits = async (userId, amountMinutes, type) => {
    if (amountMinutes <= 0) return true;
    
    const field = type === 'nylon' ? 'nc' : 'lc';
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    
    // Atomares Update (Decrement)
    await updateDoc(docRef, {
        [field]: increment(-Math.abs(amountMinutes)),
        lastTransaction: serverTimestamp()
    });
};

/**
 * Fügt Credits hinzu (Earning).
 * Kurs: 3 Minuten "Overtime" = 1 Credit.
 */
export const addCredits = async (userId, rawMinutes, type) => {
    if (rawMinutes < 3) return; // Mindestens 3 Minuten nötig für 1 Credit
    
    const earnedCredits = Math.floor(rawMinutes / 3);
    if (earnedCredits <= 0) return;

    const field = type === 'nylon' ? 'nc' : 'lc';
    const docRef = doc(db, `users/${userId}/status/timeBank`);

    // Prüfen ob Dokument existiert, sonst erstellen
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        await setDoc(docRef, { nc: 0, lc: 0, updatedAt: serverTimestamp() });
    }

    await updateDoc(docRef, {
        [field]: increment(earnedCredits),
        lastTransaction: serverTimestamp()
    });

    console.log(`TimeBank: Added ${earnedCredits} ${type.toUpperCase()} credits for ${rawMinutes} min work.`);
    return earnedCredits;
};