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
            if (docSnap.exists() && docSnap.data().currentDailyGoal !== undefined) {
                // A) Neuer Wert gefunden -> Nimm diesen
                setDailyTargetHours(docSnap.data().currentDailyGoal);
            } else {
                // B) Kein neuer Wert? -> Prüfe ALTE Settings (Legacy Fallback)
                try {
                    const prefSnap = await getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`));
                    if (prefSnap.exists() && prefSnap.data().dailyTargetHours) {
                        console.log("Using Legacy Target from Preferences:", prefSnap.data().dailyTargetHours);
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

    // 2. NACHT-COMPLIANCE LADEN (VIA SESSION END-TIME)
    // Wir schauen: Gibt es eine Instruction-Session, die HEUTE beendet wurde und "night" war?
    useEffect(() => {
        if (!currentUser) return;
        
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);

        // Query: Alle Instructions, die HEUTE geendet haben
        const qNightEnded = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('type', '==', 'instruction'),
            where('endTime', '>=', startOfDay)
        );

        const unsub = onSnapshot(qNightEnded, (snapshot) => {
            // Prüfen, ob eine davon eine Nachtsession war
            const hasEndedNightSession = snapshot.docs.some(doc => {
                const data = doc.data();
                return data.period && data.period.toLowerCase().includes('night');
            });

            if (hasEndedNightSession) {
                setNightCompliance(true);
            } else {
                // Fallback: Prüfe, ob aktuell eine Nachtsession LÄUFT (die zählt als "im Gange" -> noch nicht failed)
                // Dies ist optional, je nachdem ob du den Mond schon währenddessen golden haben willst.
                // Aktuell lassen wir ihn erst golden werden, wenn sie beendet ist (oder wir prüfen status doc).
                
                // Wir checken sicherheitshalber noch das Status-Doc als Fallback, falls die Session gestern endete
                // aber logisch zu heute gehört (Randfall).
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

        // B) Historische Sessions von HEUTE (für Progress Bar Minuten)
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
                
                // FILTER: Nacht-Sessions ignorieren für den Tages-Balken!
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
        startInstructionSession: async () => {}, 
        stopSession: async () => {},
        registerRelease: async () => {}
    };
}