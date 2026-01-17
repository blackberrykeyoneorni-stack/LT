import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { registerRelease as apiRegisterRelease } from '../../services/ReleaseService';

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ currentContinuousMinutes: 0, isDailyGoalMet: false, dailyTarget: 0 });
    const [dailyTargetHours, setDailyTargetHours] = useState(0);

    // 1. ECHTZEIT-LISTENER (Statt manuellem Laden)
    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        setLoading(true);
        
        // Wir fragen nur ab, was aktuell läuft (endTime ist null)
        // Sortierung machen wir im Client, um Index-Fehler zu vermeiden
        const q = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('endTime', '==', null)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                startTime: d.data().startTime?.toDate ? d.data().startTime.toDate() : new Date(d.data().startTime)
            }));

            // Client-seitige Sortierung (Neueste zuerst)
            sessions.sort((a, b) => b.startTime - a.startTime);
            
            setActiveSessions(sessions);
            setLoading(false);
        }, (error) => {
            console.error("Session Listener Error:", error);
            setLoading(false);
        });

        // Cleanup beim Unmounten
        return () => unsubscribe();
    }, [currentUser]);

    // 2. Tagesziel laden (Einmalig)
    useEffect(() => {
        if (!currentUser) return;
        const loadTarget = async () => {
            try {
                const sRef = doc(db, `users/${currentUser.uid}/settings/general`);
                const sSnap = await getDoc(sRef);
                if (sSnap.exists()) {
                    setDailyTargetHours(sSnap.data().dailyTarget || 0);
                }
            } catch (e) { console.error(e); }
        };
        loadTarget();
    }, [currentUser]);

    // 3. Live-Ticker (Sekündliche Berechnung für die UI)
    useEffect(() => {
        const calculateProgress = () => {
            if (activeSessions.length === 0) {
                setProgress(p => ({ ...p, currentContinuousMinutes: 0 }));
                return;
            }
            
            const now = new Date();
            let maxDuration = 0;
            
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

        calculateProgress();
        const interval = setInterval(calculateProgress, 10000); // Alle 10 sek reicht
        return () => clearInterval(interval);
    }, [activeSessions, dailyTargetHours]);

    // 4. Actions (Kein manuelles Reload mehr nötig, Listener regelt das)
    const startInstructionSession = async (instruction) => {
        if (!currentUser || !instruction) return;
        
        // Parallel Start
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
        // Listener updated UI automatisch
    };

    const stopSession = async (session, feedbackData) => {
        if (!currentUser || !session) return;
        
        // Update Session
        await updateDoc(doc(db, `users/${currentUser.uid}/sessions`, session.id), {
            endTime: serverTimestamp(),
            feelings: feedbackData?.feelings || [],
            note: feedbackData?.note || ''
        });

        // Update Item Stats (Atomar)
        if (session.itemId) {
                await updateDoc(doc(db, `users/${currentUser.uid}/items`, session.itemId), {
                lastWorn: serverTimestamp(),
                wearCount: increment(1)
                });
        }
        // Listener updated UI automatisch
    };

    const registerRelease = async (outcome, intensity) => {
        if (!currentUser) return;
        await apiRegisterRelease(currentUser.uid, outcome, intensity);
    };

    // Dummy Funktion für Rückwärtskompatibilität, falls Dashboard sie noch aufruft
    // (tut aber nichts mehr, da Listener aktiv ist)
    const loadActiveSessions = async () => {}; 

    return {
        activeSessions,
        progress,
        loading,
        dailyTargetHours,
        startInstructionSession,
        stopSession,
        registerRelease,
        loadActiveSessions 
    };
}