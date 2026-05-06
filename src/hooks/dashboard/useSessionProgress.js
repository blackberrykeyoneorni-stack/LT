// src/hooks/dashboard/useSessionProgress.js
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { DEFAULT_PROTOCOL_RULES } from '../../config/defaultRules';
import { checkAndRunWeeklyUpdate } from '../../services/ProtocolService';
import { verifyNightCompliance } from '../../services/InstructionService'; 

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nightCompliance, setNightCompliance] = useState(null);
    
    // UI Override States
    const [discountMinutes, setDiscountMinutes] = useState(0); 
    const [extortionPenalty, setExtortionPenalty] = useState(0);
    const [dynamicTargetMinutes, setDynamicTargetMinutes] = useState(null);
    
    const [dailyTargetHours, setDailyTargetHours] = useState(DEFAULT_PROTOCOL_RULES.currentDailyGoal || 4); 
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

    // 1. ZIEL & ZEITEN LADEN
    useEffect(() => {
        if (!currentUser) return;
        
        const settingsRef = doc(db, `users/${currentUser.uid}/settings/protocol`);
        
        const unsub = onSnapshot(settingsRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                if (data.currentDailyGoal !== undefined) {
                    setDailyTargetHours(data.currentDailyGoal);
                } else {
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

                if (data.time && data.time.nightStartHour !== undefined) {
                    setNightStartHour(data.time.nightStartHour);
                }

            } else {
                setDailyTargetHours(4);
                setNightStartHour(23);
            }
        }, (error) => {
            console.error("Fehler beim Laden der Protokoll-Daten:", error);
        });

        return () => unsub();
    }, [currentUser]);

    // 2. NACHT-COMPLIANCE LADEN & AUTOMATISCH VERIFIZIEREN
    useEffect(() => {
        if (!currentUser) return;

        const getLocalISODate = (date) => {
            const offset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() - offset).toISOString().split('T')[0];
        };

        const todayStr = getLocalISODate(new Date());
        const statusRef = doc(db, `users/${currentUser.uid}/status/nightCompliance`);
        
        let intervalId;

        const unsub = onSnapshot(statusRef, (snap) => {
           let needsVerification = false;
           if(snap.exists()) {
               const data = snap.data();
               if (data.date === todayStr) {
                   setNightCompliance(data.success);
               } else {
                   setNightCompliance(null); 
                   needsVerification = true;
               }
           } else {
               setNightCompliance(null);
               needsVerification = true;
           }

           if (needsVerification) {
               const checkAndVerify = async () => {
                   const d = new Date();
                   if (d.getHours() > 7 || (d.getHours() === 7 && d.getMinutes() >= 30)) {
                       if (intervalId) clearInterval(intervalId);
                       await verifyNightCompliance(currentUser.uid);
                   }
               };
               
               checkAndVerify(); 
               
               const d = new Date();
               if (!(d.getHours() > 7 || (d.getHours() === 7 && d.getMinutes() >= 30)) && !intervalId) {
                   intervalId = setInterval(checkAndVerify, 60000);
               }
           } else {
               if (intervalId) clearInterval(intervalId);
           }
        });

        return () => {
            unsub();
            if (intervalId) clearInterval(intervalId);
        };
    }, [currentUser]);

    // 2b. INSTRUCTION STATUS LISTENER (Dynamische Ziele & Modifikatoren)
    useEffect(() => {
        if (!currentUser) return;
        const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
        const unsub = onSnapshot(instrRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setDiscountMinutes(data.discountMinutes || 0);
                setExtortionPenalty(data.extortionPenalty || 0);
                
                // Falls das System (z.B. durch Erpressung) die Dauer fest auf das Dokument geschrieben hat
                if (data.durationMinutes) {
                    setDynamicTargetMinutes(data.durationMinutes);
                } else {
                    setDynamicTargetMinutes(null);
                }
            } else {
                setDiscountMinutes(0);
                setExtortionPenalty(0);
                setDynamicTargetMinutes(null);
            }
        });
        return () => unsub();
    }, [currentUser]);

    // 3. Aktive Sessions & Historie Heute laden
    useEffect(() => {
        if (!currentUser) return;

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

        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        
        const qHistory = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('startTime', '>=', startOfDay),
            where('type', 'in', ['instruction', 'tzd']) 
        );

        const unsubHistory = onSnapshot(qHistory, (snapshot) => {
            let maxDuration = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const isNight = data.periodId && data.periodId.toLowerCase().includes('night');

                if (!isNight && data.endTime) {
                    let duration = (data.endTime.toDate() - data.startTime.toDate()) / 60000;
                    if (data.discountMinutes) duration += data.discountMinutes;
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
        
        // Dynamisches Ziel überschreibt das Basis-Protokoll-Ziel
        let targetMinutes = dynamicTargetMinutes !== null ? dynamicTargetMinutes : (dailyTargetHours * 60);
        if (targetMinutes < 0) targetMinutes = 0; 
        
        // Harter Reset am späten Abend (Nacht-Phase beginnt)
        if (now.getHours() >= nightStartHour) {
            return {
                currentContinuousMinutes: discountMinutes,
                dailyTargetMinutes: targetMinutes,
                percentage: 0,
                isDailyGoalMet: false, 
                isLive: false,
                nightCompliance,
                discountMinutes,
                extortionPenalty
            };
        }

        const activeInstruction = activeSessions.find(s => 
            (s.type === 'instruction' || s.type === 'tzd') && 
            (!s.periodId || !s.periodId.includes('night'))
        );

        let currentMinutes = 0;
        let isLive = false;

        if (activeInstruction && activeInstruction.instructionReadyTime) {
            const start = activeInstruction.instructionReadyTime?.toDate ? activeInstruction.instructionReadyTime.toDate() : new Date(activeInstruction.instructionReadyTime);
            // Injektion des Vorschusses
            currentMinutes = Math.floor((now - start) / 60000) + discountMinutes;
            isLive = true;
        } else {
            // Injektion des Vorschusses in die ruhende Zeit
            currentMinutes = Math.floor(completedTodayMinutes) + discountMinutes;
        }

        const isGoalMet = currentMinutes >= targetMinutes;

        if (!isLive && !isGoalMet) {
            // BUGFIX: Kombinierte Zeit aus bereits abgeleisteter Zeit PLUS Discount
            currentMinutes = Math.floor(completedTodayMinutes) + discountMinutes;
        }

        return {
            currentContinuousMinutes: currentMinutes,
            dailyTargetMinutes: targetMinutes,
            percentage: Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100)),
            isDailyGoalMet: isGoalMet,
            isLive,
            nightCompliance,
            discountMinutes,
            extortionPenalty
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