// src/services/SuspensionService.js
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

const COLLECTION = 'suspensions';

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
        packedItemIds: data.packedItemIds || [], 
        packedItemsDay: data.packedItemsDay || [], 
        packedItemsNight: data.packedItemsNight || [],
        createdAt: Timestamp.now(),
        status: 'scheduled'
    });
};

export const deleteScheduledSuspension = async (userId, suspensionId) => {
    await deleteDoc(doc(db, `users/${userId}/${COLLECTION}`, suspensionId));
};

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
        return [];
    }
};

export const checkActiveSuspension = async (userId) => {
    const now = new Date();
    
    const timeRules = DEFAULT_PROTOCOL_RULES?.time || { 
        dayStartHour: 7, 
        dayStartMinute: 30, 
        nightStartHour: 23, 
        nightStartMinute: 0 
    };

    const qActive = query(
        collection(db, `users/${userId}/${COLLECTION}`),
        where('status', '==', 'active')
    );
    const snapActive = await getDocs(qActive);
    
    if (!snapActive.empty) {
        const docSnap = snapActive.docs[0];
        const data = docSnap.data();
        const end = data.endDate.toDate();

        const endOfSuspension = new Date(end);
        endOfSuspension.setHours(timeRules.nightStartHour, timeRules.nightStartMinute, 0, 0);

        if (endOfSuspension < now) {
            await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, docSnap.id), { status: 'completed' });
            
            if (data.type === 'stealth_travel') {
                const qLedger = query(collection(db, `users/${userId}/punishmentLedger`), where('status', '==', 'pending'), where('isStealthAkkumulation', '==', true));
                const ledgerSnap = await getDocs(qLedger);
                if (!ledgerSnap.empty) {
                    const batch = writeBatch(db);
                    ledgerSnap.forEach(ticket => batch.update(ticket.ref, { isStealthAkkumulation: false }));
                    await batch.commit();
                }
            }
            
            await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), { 
                activeSuspension: false,
                suspensionReason: null,
                stealthModeActive: false 
            });
            
            return null;
        }
        return { id: docSnap.id, ...data, startDate: data.startDate.toDate(), endDate: end };
    }

    const qScheduled = query(
        collection(db, `users/${userId}/${COLLECTION}`),
        where('status', '==', 'scheduled')
    );
    const snapScheduled = await getDocs(qScheduled);
    
    for (const d of snapScheduled.docs) {
        const data = d.data();
        const start = data.startDate.toDate();
        const end = data.endDate.toDate();
        
        const startOfSuspension = new Date(start);
        startOfSuspension.setHours(timeRules.dayStartHour, timeRules.dayStartMinute, 0, 0);

        if (startOfSuspension <= now) {
            await updateDoc(doc(db, `users/${userId}/${COLLECTION}`, d.id), { status: 'active' });
            
            await updateDoc(doc(db, `users/${userId}/status/tzd`), {
                isActive: false,
                result: 'terminated_by_suspension',
                endTime: Timestamp.now()
            });

            if (data.type === 'stealth_travel') {
                
                // NEU: Alle offenen Strafen beim Start der Stealth-Phase in den Akkumulations-Modus zwingen
                try {
                    const qLedgerPending = query(
                        collection(db, `users/${userId}/punishmentLedger`), 
                        where('status', '==', 'pending'), 
                        where('isStealthAkkumulation', '==', false)
                    );
                    const ledgerPendingSnap = await getDocs(qLedgerPending);
                    if (!ledgerPendingSnap.empty) {
                        const batch = writeBatch(db);
                        ledgerPendingSnap.forEach(ticket => {
                            batch.update(ticket.ref, { isStealthAkkumulation: true });
                        });
                        await batch.commit();
                        console.log("Stealth Mode: Altlasten ins Zins-Ledger überführt.");
                    }
                } catch (e) {
                    console.error("Fehler beim Transfer der Altlasten in den Stealth-Modus:", e);
                }

                await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
                    evasionPenaltyTriggered: false, 
                    tzdDurationMinutes: 0,
                    stealthModeActive: true 
                });
            } else {
                await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
                    evasionPenaltyTriggered: false, 
                    tzdDurationMinutes: 0,
                    activeSuspension: true, 
                    suspensionReason: data.reason
                });
            }
            
            return { id: d.id, ...data, status: 'active', startDate: start, endDate: end };
        }
    }

    return null;
};

// --- IRON CONTRACT PROTOCOL ---
export const terminateSuspension = async (userId, suspensionId) => {
    throw new Error("SYSTEM SPERRE: Ein vorzeitiger Abbruch einer geplanten Ausfallzeit ist systemseitig gesperrt (Iron Contract). Die Zeit muss zwingend abgesessen werden.");
};