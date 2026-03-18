import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { safeDate } from '../utils/statsCalculator';

export const fetchStatsData = async (userId) => {
    const items = [];
    const sessions = [];

    const iSnap = await getDocs(collection(db, `users/${userId}/items`));
    iSnap.docs.forEach(d => {
        items.push({ 
            id: d.id, ...d.data(), 
            purchaseDate: safeDate(d.data().purchaseDate) || new Date()
        });
    });

    const sSnap = await getDocs(query(collection(db, `users/${userId}/sessions`), orderBy('startTime', 'asc')));
    sSnap.docs.forEach(d => {
        sessions.push({ 
            id: d.id, ...d.data(), 
            startTime: safeDate(d.data().startTime) || new Date(),
            endTime: safeDate(d.data().endTime)
        });
    });

    return { items, sessions };
};