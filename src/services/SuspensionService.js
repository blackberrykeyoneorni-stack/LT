import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

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
 * Lädt ALLE Aussetzungen (auch vergangene) für den Kalender.
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
 * FIX: Beendet bei Aktivierung AUTOMATISCH alle laufenden TZD-Strafen.
 */
export const checkActiveSuspension = async (userId) => {
    const now = new Date();
    
    // Sicherheits-Fallback
    const timeRules = DEFAULT_PROTOCOL_RULES?.time || { 
        dayStartHour: 7, 
        dayStartMinute: 30, 
        nightStartHour: 23, 
        nightStartMinute: 0 
    };

    // 1. Gibt es bereits eine aktive Aussetzung?
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
        const endOfSuspension = new Date(end);
        endOfSuspension.setHours(timeRules.nightStartHour, timeRules.nightStartMinute, 0, 0);

        if (endOfSuspension < now) {
            // Aussetzung ist vorbei -> Status auf 'completed'
            await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, docSnap.id), { status: 'completed' });
            
            // Suspension Flag im Daily Doc entfernen, damit Protokoll wieder greifen kann
            await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), { 
                activeSuspension: false,
                suspensionReason: null
            });
            
            return null;
        }
        return { id: docSnap.id, ...data, startDate: data.startDate.toDate(), endDate: end };
    }

    // 2. Gibt es eine geplante Aussetzung, die heute starten muss?
    const qScheduled = query(
        collection(db, `users/${userId}/${COLLECTION}`),
        where('status', '==', 'scheduled')
    );
    const snapScheduled = await getDocs(qScheduled);
    
    for (const d of snapScheduled.docs) {
        const data = d.data();
        const start = data.startDate.toDate();
        const end = data.endDate.toDate();
        
        // Startzeitpunkt prüfen (z.B. 07:30)
        const startOfSuspension = new Date(start);
        startOfSuspension.setHours(timeRules.dayStartHour, timeRules.dayStartMinute, 0, 0);

        if (startOfSuspension <= now) {
            // ZEIT ERREICHT -> AKTIVIERUNG
            await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, d.id), { status: 'active' });
            
            // --- CRITICAL FIX: KOLLISIONS-BEREINIGUNG ---
            // Wenn die Aussetzung startet, müssen Altlasten (TZD vom Vortag) sofort sterben.
            
            // A) TZD Status Doc killen (das Overlay verschwindet)
            await updateDoc(doc(db, `users/${userId}/status/tzd`), {
                isActive: false,
                result: 'terminated_by_suspension',
                endTime: Timestamp.now()
            });

            // B) Daily Instruction säubern (Die Strafe wird deaktiviert)
            await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
                evasionPenaltyTriggered: false, // WICHTIG: Stoppt die 150% Logik
                tzdDurationMinutes: 0,
                activeSuspension: true, // Markiert User als 'entschuldigt'
                suspensionReason: data.reason
            });
            
            console.log(`Suspension activated. TZD terminated. Reason: ${data.reason}`);
            // ----------------------------------------------

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
    
    // Auch das Daily Flag resetten, damit man sofort wieder teilnehmen kann
    await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), { 
        activeSuspension: false,
        suspensionReason: null
    });
};