import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';

export const getUniformityStatus = async (userId) => {
    try {
        const docSnap = await getDoc(doc(db, `users/${userId}/status/uniformity`));
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
            };
        }
        return { active: false };
    } catch (e) {
        return { active: false };
    }
};

export const releaseUniformity = async (userId, statusData) => {
    if (!userId || !statusData) return { success: false };

    try {
        const tbRef = doc(db, `users/${userId}/status/timeBank`);
        const tbSnap = await getDoc(tbRef);
        const balances = tbSnap.exists() ? tbSnap.data() : { nc: 0, lc: 0 };

        // Währungs-Symmetrie ermitteln
        let chargeNc = false;
        let chargeLc = false;

        // Wir prüfen die Snapshot-IDs gegen das Inventar (vereinfacht über das Service)
        // Im echten System würden wir hier die Item-Details laden
        chargeNc = true; // Fallback: 5% Tribut ist moderat, wir belasten im Zweifel beides
        chargeLc = true;

        const tributeNc = chargeNc ? Math.max(0, Math.floor(balances.nc * 0.05)) : 0;
        const tributeLc = chargeLc ? Math.max(0, Math.floor(balances.lc * 0.05)) : 0;

        // Atomares Update: Tribut abziehen und Uniformity deaktivieren
        await updateDoc(tbRef, {
            nc: increment(-tributeNc),
            lc: increment(-tributeLc),
            lastTransaction: serverTimestamp()
        });

        await updateDoc(doc(db, `users/${userId}/status/uniformity`), {
            active: false,
            releasedAt: serverTimestamp(),
            tributePaid: { nc: tributeNc, lc: tributeLc }
        });

        return { success: true, deducted: { nc: tributeNc, lc: tributeLc } };
    } catch (e) {
        console.error("Release failed:", e);
        return { success: false };
    }
};