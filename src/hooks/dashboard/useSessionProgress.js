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
    
    // NEU: Wir laden auch den Nacht-Start, um den Reset-Zeitpunkt zu kennen (Default 23 Uhr)
    const [nightStartHour, setNightStartHour] = useState(23); 

    const [completedTodayMinutes, setCompletedTodayMinutes] = useState(0);

    // 0. AUTOMATISCHER WOCHEN-CHECK
    useEffect(() => {
        if (!currentUser) return;
        const runUpdate = async () => {
            await checkAndRunWeeklyUpdate(currentUser.uid);
        };
        runUpdate();
    }, [currentUser]);

    // 1. ZIEL & ZEITEN LADEN (MIT LEGACY FALLBACK)
    useEffect(() => {
        if (!currentUser) return;
        
        // Listener auf das NEUE Protokoll-System
        const settingsRef = doc(db, `users/${currentUser.uid}/settings/protocol`);
        
        const unsub = onSnapshot(settingsRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // A) Ziel laden
                if (data.currentDailyGoal !== undefined) {
                    setDailyTargetHours(data.currentDailyGoal);
                } else {
                    // Fallback auf Legacy Settings, wenn im neuen Doc nichts steht
                    try {
                        const prefSnap = await getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`));
                        if (prefSnap.exists() && prefSnap.data().dailyTargetHours) {
                            setDailyTargetHours(prefSnap.data().dailyTargetHours);
                        } else {
                            setDailyTargetHours(4);
                        }
                    } catch (e) {
                        setDailyTargetHours(4);
                    }
                }

                // B) Nacht-Start laden (für den Reset um 23:00 Uhr)
                if (data.time && data.time.nightStartHour !== undefined) {
                    setNightStartHour(data.time.nightStartHour);
                }

            } else {
                // Wenn Dokument gar nicht existiert -> Fallback auf Defaults
                setDailyTargetHours(4);
                setNightStartHour(23);
            }
        }, (error) => {
            console.error("Fehler beim Laden der Protokoll-Daten:", error);
        });

        return () => unsub();
    }, [currentUser]);

    // 2. NACHT-COMPLIANCE LADEN (VIA SESSION END-TIME)
    useEffect(() => {
        if (!currentUser) return;
        
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);

        const qNightEnded = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('type', '==', 'instruction'),
            where('endTime', '>=', startOfDay)
        );

        const unsub = onSnapshot(qNightEnded, (snapshot) => {
            const hasEndedNightSession = snapshot.docs.some(doc => {
                const data = doc.data();
                return data.period && data.period.toLowerCase().includes('night');
            });

            if (hasEndedNightSession) {
                setNightCompliance(true);
            } else {
                // Fallback: Status Doc prüfen
                getDoc(doc(db, `users/${currentUser.uid}/status/nightCompliance`)).then(snap => {
                   if(snap.exists() && snap.data().success && snap.data().date === new Date().toISOString().split('T')[0]) {
                       setNightCompliance(true);
                   } else {
                       setNightCompliance(false);
                   }
                });
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
                // Nacht-Sessions ignorieren für den Tages-Balken
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

    // 4. Progress Berechnung (MIT 23:00 UHR RESET LOGIK)
    const calculateProgress = () => {
        const now = new Date();
        
        // RESET-CHECK: Ist es nach 23:00 Uhr (oder der eingestellten Startzeit)?
        // Wenn ja, ist der "Tag" vorbei und der Balken wird auf 0 gesetzt.
        if (now.getHours() >= nightStartHour) {
            return {
                currentContinuousMinutes: 0,
                dailyTargetMinutes: dailyTargetHours * 60,
                percentage: 0,
                isDailyGoalMet: false, // Tag vorbei -> Reset
                isLive: false,
                nightCompliance
            };
        }

        // --- Normale Berechnung (vor 23:00 Uhr) ---
        
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
            currentMinutes = Math.floor(completedTodayMinutes);
        }

        const targetMinutes = dailyTargetHours * 60;
        const isGoalMet = currentMinutes >= targetMinutes;

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
        startInstructionSession: async () => {}, 
        stopSession: async () => {},
        registerRelease: async () => {}
    };
}