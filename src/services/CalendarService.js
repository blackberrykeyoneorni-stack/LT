import { collection, query, getDocs, addDoc, Timestamp, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const fetchCalendarSessions = async (userId, items) => {
    const q = query(collection(db, `users/${userId}/sessions`));
    const snap = await getDocs(q);
    const now = new Date(); 
    
    const loadedSessions = [];

    snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const sessionItems = (data.itemIds || [data.itemId]).map(id => items.find(i => i.id === id)).filter(Boolean);
        
        let hasNylon = false;
        let hasLingerie = false;
        
        // SINGLE SOURCE OF TRUTH CHECK
        sessionItems.forEach(item => {
            const cat = (item.mainCategory || '').toLowerCase();
            
            if (cat === 'nylons') {
                hasNylon = true;
            }
            else if (cat === 'wäsche' || cat === 'dessous') {
                hasLingerie = true;
            }
        });

        if (!data.startTime) return;

        const start = data.startTime.toDate();
        let end;
        let isActive = false;

        // Simulation des Endes für geplante Sessions im Kalender
        if (data.type === 'planned' && !data.endTime && data.durationMinutes) {
            end = new Date(start.getTime() + data.durationMinutes * 60000);
        } else {
            end = data.endTime ? data.endTime.toDate() : now;
            isActive = !data.endTime;
        }

        // VIRTUELLER SCHNITT: Sessions über Mitternacht in Tagesfragmente aufteilen
        let currentStart = new Date(start.getTime());

        while (currentStart < end) {
            const currentEndDay = new Date(currentStart);
            currentEndDay.setHours(23, 59, 59, 999);

            // Das Ende des aktuellen Fragments ist entweder das wirkliche Ende oder Mitternacht
            const fragmentEnd = end < currentEndDay ? end : currentEndDay;
            const diffMins = Math.floor((fragmentEnd.getTime() - currentStart.getTime()) / 60000);

            if (diffMins > 0) {
                loadedSessions.push({
                    id: `${docSnap.id}_${currentStart.getTime()}`, // Eindeutige ID pro Fragment
                    originalId: docSnap.id,
                    date: new Date(currentStart.getTime()),
                    duration: diffMins,
                    type: data.type,
                    isActive: isActive && (fragmentEnd.getTime() === end.getTime()), // Nur letztes Fragment ist aktiv
                    hasNylon,
                    hasLingerie,
                    items: sessionItems 
                });
            }

            // Für den nächsten Schleifendurchlauf auf 00:00:00 Uhr des Folgetags setzen
            currentStart = new Date(currentEndDay.getTime() + 1);
        }
    });
    
    loadedSessions.sort((a, b) => a.date - b.date);
    return loadedSessions;
};

export const addPlannedSession = async (userId, sessionData) => {
    return await addDoc(collection(db, `users/${userId}/sessions`), {
        ...sessionData,
        startTime: Timestamp.fromDate(sessionData.startTime),
        createdAt: serverTimestamp() 
    });
};

export const deletePlannedSession = async (userId, sessionId) => {
    return await deleteDoc(doc(db, `users/${userId}/sessions`, sessionId));
};