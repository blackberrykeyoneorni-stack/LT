import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { DEFAULT_PROTOCOL_RULES } from '../../config/defaultRules';
import { checkAndRunWeeklyUpdate } from '../../services/ProtocolService';

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nightCompliance, setNightCompliance] = useState(null);
    
    // Startwert 4 (Fallback)
    const [dailyTargetHours, setDailyTargetHours] = useState(DEFAULT_PROTOCOL_RULES.currentDailyGoal || 4); 
    
    const [completedTodayMinutes, setCompletedTodayMinutes] = useState(0);

    // 0. AUTOMATISCHER WOCHEN-CHECK
    useEffect(() => {
        if (!currentUser) return;
        const runUpdate = async () => {
            await checkAndRunWeeklyUpdate(currentUser.uid);
        };
        runUpdate();
    }, [currentUser]);

    // 1. ZIEL LADEN (MIT LEGACY FALLBACK)
    useEffect(() => {
        if (!currentUser) return;
        
        // Listener auf das NEUE Protokoll-System
        const settingsRef = doc(db, `users/${currentUser.uid}/settings/protocol`);
        
        const unsub = onSnapshot(settingsRef, async (docSnap) => {
            // A) Neuer Wert gefunden? -> Nimm diesen
            if (docSnap.exists() && docSnap.data().currentDailyGoal !== undefined) {
                setDailyTargetHours(docSnap.data().currentDailyGoal);
            } else {
                // B) Kein neuer Wert? -> Prüfe ALTE Settings (Legacy Fallback)
                try {
                    const prefSnap = await getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`));
                    if (prefSnap.exists() && prefSnap.data().dailyTargetHours) {
                        console.log("Using Legacy Target from Preferences (Migration):", prefSnap.data().dailyTargetHours);
                        setDailyTargetHours(prefSnap.data().dailyTargetHours);
                    } else {
                        // C) Weder neu noch alt -> Standard 4
                        setDailyTargetHours(4);
                    }
                } catch (e) {
                    console.error("Error fetching legacy preferences:", e);
                    setDailyTargetHours(4);
                }
            }
        }, (error) => {
            console.error("Fehler beim Laden des Tagesziels:", error);
        });

        return () => unsub();
    }, [currentUser]);

    // 2. Nacht-Compliance laden
    useEffect(() => {
        if (!currentUser) return;
        const unsub = onSnapshot(doc(db, `users/${currentUser.uid}/status/nightCompliance`), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const todayKey = new Date().toISOString().split('T')[0];
                if (data.date === todayKey) {
                    setNightCompliance(data.success);
                } else {
                    setNightCompliance(false);
                }
            } else {
                setNightCompliance(false);
            }
        });
        return () => unsub();
    }, [currentUser]);

    // 3. Aktive Sessions & Historie Heute laden
    useEffect(() => {
        if (!currentUser) return;

        // A) Aktive Sessions
        const qActive = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('endTime', '==', null)
        );

        const unsubActive = onSnapshot(qActive, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                startTime: doc.data().startTime?.toDate() || new Date()
            }));
            setActiveSessions(sessions);
            setLoading(false);
        });

        // B) Historische Sessions von HEUTE
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        
        const qHistory = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('startTime', '>=', startOfDay),
            where('type', '==', 'instruction')
        );

        const unsubHistory = onSnapshot(qHistory, (snapshot) => {
            let maxDuration = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                
                // FILTER: Nacht-Sessions ignorieren!
                // Das Tagesziel (ProgressBar) bildet nur die Day-Session ab.
                const isNight = data.period && data.period.toLowerCase().includes('night');

                if (!isNight && data.endTime) {
                    const duration = (data.endTime.toDate() - data.startTime.toDate()) / 60000;
                    if (duration > maxDuration) maxDuration = duration;
                }
            });
            setCompletedTodayMinutes(maxDuration);
        });

        return () => {
            unsubActive();
            unsubHistory();
        };
    }, [currentUser]);

    // 4. Progress Berechnung
    const calculateProgress = () => {
        const now = new Date();
        
        // Auch bei aktiven Sessions: Nur zählen, wenn es KEINE Nacht-Session ist
        const activeInstruction = activeSessions.find(s => 
            s.type === 'instruction' && 
            (!s.period || !s.period.includes('night'))
        );

        let currentMinutes = 0;
        let isLive = false;

        if (activeInstruction) {
            const start = activeInstruction.startTime;
            currentMinutes = Math.floor((now - start) / 60000);
            isLive = true;
        } else {
            // Nur anzeigen, wenn das Ziel heute schonmal erreicht wurde (historisch)
            currentMinutes = Math.floor(completedTodayMinutes);
        }

        const targetMinutes = dailyTargetHours * 60;
        
        // Logik: Ziel gilt als erreicht, wenn aktuelle ODER historische Zeit (Tag) >= Ziel
        const isGoalMet = currentMinutes >= targetMinutes;

        // Wenn Session inaktiv und Ziel nicht erreicht -> Reset auf 0 (Alles oder Nichts)
        if (!isLive && !isGoalMet) {
            currentMinutes = 0;
        }

        return {
            currentContinuousMinutes: currentMinutes,
            dailyTargetMinutes: targetMinutes,
            percentage: Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100)),
            isDailyGoalMet: isGoalMet,
            isLive,
            nightCompliance
        };
    };

    return {
        activeSessions,
        loading,
        progress: calculateProgress(),
        dailyTargetHours,
        nightCompliance,
        // Dummies
        startInstructionSession: async () => {}, 
        stopSession: async () => {},
        registerRelease: async () => {}
    };
}