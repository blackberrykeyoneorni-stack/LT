import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, getDoc, orderBy, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { registerRelease as apiRegisterRelease } from '../../services/ReleaseService';

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ currentContinuousMinutes: 0, isDailyGoalMet: false, dailyTarget: 0 });
    const [dailyTargetHours, setDailyTargetHours] = useState(0);

    // 1. Lade-Logik (Explizit exportiert für manuellen Trigger im Dashboard)
    const loadActiveSessions = useCallback(async () => {
        if (!currentUser) return;
        try {
            // Lade nur Sessions, die noch nicht beendet sind (endTime == null)
            const q = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                where('endTime', '==', null),
                orderBy('startTime', 'desc')
            );
            const snapshot = await getDocs(q);
            
            const sessions = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                // Sicheres Date-Handling für Timestamps
                startTime: d.data().startTime?.toDate ? d.data().startTime.toDate() : new Date(d.data().startTime)
            }));
            
            setActiveSessions(sessions);
        } catch (error) {
            console.error("Critical Error loading sessions:", error);
        }
    }, [currentUser]);

    // 2. Initialisierung & Ziel-Laden
    useEffect(() => {
        if (!currentUser) return;
        const init = async () => {
            setLoading(true);
            await loadActiveSessions();
            try {
                const sRef = doc(db, `users/${currentUser.uid}/settings/general`);
                const sSnap = await getDoc(sRef);
                if (sSnap.exists()) {
                    setDailyTargetHours(sSnap.data().dailyTarget || 0);
                }
            } catch (e) { console.error("Error loading target:", e); }
            setLoading(false);
        };
        init();
    }, [currentUser, loadActiveSessions]);

    // 3. Live-Ticker (Berechnet Minuten lokal weiter, ohne DB Call)
    useEffect(() => {
        const calculateProgress = () => {
            if (activeSessions.length === 0) {
                setProgress(p => ({ ...p, currentContinuousMinutes: 0 }));
                return;
            }
            
            const now = new Date();
            let maxDuration = 0;
            
            // Ermittle die längste laufende Session
            activeSessions.forEach(s => {
                if (s.startTime) {
                    const diff = (now - s.startTime) / 1000 / 60; // Minuten
                    if (diff > maxDuration) maxDuration = diff;
                }
            });

            const isMet = dailyTargetHours > 0 && (maxDuration / 60) >= dailyTargetHours;
            
            setProgress({
                currentContinuousMinutes: Math.floor(maxDuration),
                isDailyGoalMet: isMet,
                dailyTarget: dailyTargetHours
            });
        };

        calculateProgress(); // Sofort
        const interval = setInterval(calculateProgress, 60000); // Dann jede Minute
        return () => clearInterval(interval);
    }, [activeSessions, dailyTargetHours]);

    // 4. Aktionen
    const startInstructionSession = async (instruction) => {
        if (!currentUser || !instruction) return;
        try {
            const promises = instruction.items.map(item => {
                return addDoc(collection(db, `users/${currentUser.uid}/sessions`), {
                    itemId: item.id,
                    itemIds: [item.id],
                    type: 'instruction',
                    instructionId: instruction.id || 'manual',
                    periodId: instruction.periodId || null,
                    startTime: serverTimestamp(),
                    endTime: null
                });
            });
            await Promise.all(promises);
            // WICHTIG: Liste neu laden, damit UI updated
            await loadActiveSessions();
        } catch (e) {
            console.error("Error starting session:", e);
            throw e;
        }
    };

    const stopSession = async (session, feedbackData) => {
        if (!currentUser || !session) return;
        try {
            // Session beenden
            await updateDoc(doc(db, `users/${currentUser.uid}/sessions`, session.id), {
                endTime: serverTimestamp(),
                feelings: feedbackData?.feelings || [],
                note: feedbackData?.note || ''
            });

            // Item Statistik aktualisieren (Atomar sicher)
            if (session.itemId) {
                 await updateDoc(doc(db, `users/${currentUser.uid}/items`, session.itemId), {
                    lastWorn: serverTimestamp(),
                    wearCount: increment(1) // IT-Prüfer Anmerkung: Viel sicherer als Client-Addition
                 });
            }
            // UI aktualisieren
            await loadActiveSessions();
        } catch (e) {
            console.error("Error stopping session:", e);
            throw e;
        }
    };

    const registerRelease = async (outcome, intensity) => {
        if (!currentUser) return;
        await apiRegisterRelease(currentUser.uid, outcome, intensity);
    };

    // EXPORT
    return {
        activeSessions,
        progress,
        loading,
        dailyTargetHours,
        startInstructionSession,
        stopSession,
        registerRelease,
        loadActiveSessions // MUSS exportiert sein!
    };
}