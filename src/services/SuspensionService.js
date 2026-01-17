import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore';

const COLLECTION = 'suspensions';

/**
 * Erstellt eine neue geplante Aussetzung.
 * REGEL: Startdatum muss > Heute sein (Pre-Planning Constraint).
 */
export const addSuspension = async (userId, data) => {
    const start = new Date(data.startDate);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (start <= todayEnd) {
        throw new Error("Unzulässig: Aussetzungen müssen mindestens für den Folgetag geplant werden.");
    }

    await addDoc(collection(db, `users/${userId}/${COLLECTION}`), {
        type: data.type,
        reason: data.reason,
        startDate: Timestamp.fromDate(new Date(data.startDate)),
        endDate: Timestamp.fromDate(new Date(data.endDate)),
        createdAt: Timestamp.now(),
        status: 'scheduled'
    });
};

/**
 * Lädt NUR aktive oder geplante Aussetzungen (für Dashboard/Checks).
 */
export const getSuspensions = async (userId) => {
    const q = query(
        collection(db, `users/${userId}/${COLLECTION}`),
        where('status', 'in', ['scheduled', 'active']),
        orderBy('startDate', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        startDate: d.data().startDate.toDate(),
        endDate: d.data().endDate.toDate()
    }));
};

/**
 * NEU: Lädt ALLE Aussetzungen (auch vergangene) für den Kalender.
 */
export const getAllSuspensions = async (userId) => {
    try {
        const q = query(
            collection(db, `users/${userId}/${COLLECTION}`),
            orderBy('startDate', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            startDate: d.data().startDate?.toDate ? d.data().startDate.toDate() : new Date(d.data().startDate),
            endDate: d.data().endDate?.toDate ? d.data().endDate.toDate() : new Date(d.data().endDate)
        }));
    } catch (e) {
        console.error("Error loading history:", e);
        return [];
    }
};

/**
 * Prüft beim App-Start, ob HEUTE eine Aussetzung aktiv ist.
 * Schaltet 'scheduled' automatisch auf 'active' um, wenn die Zeit gekommen ist.
 */
export const checkActiveSuspension = async (userId) => {
    const now = new Date();
    
    // 1. Gibt es bereits eine aktive?
    const qActive = query(
        collection(db, `users/${userId}/${COLLECTION}`),
        where('status', '==', 'active')
    );
    const snapActive = await getDocs(qActive);
    
    if (!snapActive.empty) {
        const docSnap = snapActive.docs[0];
        const data = docSnap.data();
        const end = data.endDate.toDate();

        // Check: Ist sie abgelaufen?
        // Wir setzen das Ende auf 23:59:59 des Endtages
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);

        if (endOfDay < now) {
            await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, docSnap.id), { status: 'completed' });
            return null;
        }
        return { id: docSnap.id, ...data, startDate: data.startDate.toDate(), endDate: end };
    }

    // 2. Gibt es eine geplante, die heute starten muss?
    const qScheduled = query(
        collection(db, `users/${userId}/${COLLECTION}`),
        where('status', '==', 'scheduled')
    );
    const snapScheduled = await getDocs(qScheduled);
    
    for (const d of snapScheduled.docs) {
        const data = d.data();
        const start = data.startDate.toDate();
        const end = data.endDate.toDate();
        
        // Startzeitpunkt prüfen (ab 00:00 des Starttages)
        const startOfDay = new Date(start);
        startOfDay.setHours(0, 0, 0, 0);

        if (startOfDay <= now) {
            // Aktivierung!
            await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, d.id), { status: 'active' });
            return { id: d.id, ...data, status: 'active', startDate: start, endDate: end };
        }
    }

    return null;
};

/**
 * Beendet eine Aussetzung vorzeitig (z.B. frühere Entlassung aus Krankenhaus).
 */
export const terminateSuspension = async (userId, suspensionId) => {
    await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, suspensionId), {
        status: 'terminated',
        terminatedAt: Timestamp.now()
    });
};