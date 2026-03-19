import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const acknowledgeWeeklyReport = async (userId) => {
    if (!userId) throw new Error("UserID fehlt.");
    
    try {
        const docRef = doc(db, `users/${userId}/settings/protocol`);
        await updateDoc(docRef, {
            'weeklyReport.acknowledged': true
        });
    } catch (e) {
        console.error("Fehler beim Quittieren des Wochenberichts:", e);
        throw e;
    }
};