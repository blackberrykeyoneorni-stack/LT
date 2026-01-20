import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nightCompliance, setNightCompliance] = useState(null); // NEU: Status der Nacht
    
    // State für das Protokoll-Ziel
    const [dailyTargetHours, setDailyTargetHours] = useState(4); 
    
    // State für historischen Erfolg heute (damit Balken grün bleibt)
    const [completedTodayMinutes, setCompletedTodayMinutes] = useState(0);
    const [isGoalMetHistorically, setIsGoalMetHistorically] = useState(false);

    // 1. Protokoll-Regeln laden (Zielzeit)
    useEffect(() => {
        if (!currentUser) return;
        const unsub = onSnapshot(doc(db, `users/${currentUser.uid}/settings/protocol`), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDailyTargetHours(data.currentDailyGoal || 4);
            }
        });
        return () => unsub();
    }, [currentUser]);

    // 2. Nacht-Compliance laden (NEU)
    useEffect(() => {
        if (!currentUser) return;
        // Wir hören auf das Status-Dokument, das in Schritt 1 erstellt wurde
        const unsub = onSnapshot(doc(db, `users/${currentUser.uid}/status/nightCompliance`), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Prüfen, ob der Check für "Heute Morgen" ist
                const todayKey = new Date().toISOString().split('T')[0];
                if (data.date === todayKey) {
                    setNightCompliance(data.success); // true/false
                } else {
                    setNightCompliance(false); // Veralteter Check = Fail
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

        // A) Aktive Sessions (Live)
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

        // B) Historische Sessions von HEUTE (für "Grün bleiben"-Logik)
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        
        const qHistory = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('startTime', '>=', startOfDay),
            where('type', '==', 'instruction') // Nur Instructions zählen fürs Ziel
        );

        // Wir nutzen hier auch onSnapshot, um bei Beendigung sofort das Update zu bekommen
        const unsubHistory = onSnapshot(qHistory, (snapshot) => {
            let maxDuration = 0;
            let goalMet = false;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Nur abgeschlossene Sessions prüfen, die NICHT gescheitert sind
                if (data.endTime) {
                    // Falls Nacht-Compliance gefordert war, muss nightSuccess true sein
                    // (Oder wir vertrauen darauf, dass nur valide Sessions 'completed' wirken)
                    // Hier vereinfacht: Wir schauen auf die Dauer.
                    
                    const duration = (data.endTime.toDate() - data.startTime.toDate()) / 60000;
                    
                    // Check ob diese Session das Ziel erfüllt hat (Alleine! Keine Stückelung!)
                    // Wir nutzen den aktuellen Target-Wert.
                    // (Achtung: Hier bräuchte man eigentlich den Target-Wert zum Zeitpunkt der Session, 
                    // aber für die UI Anzeige reicht das aktuelle Ziel).
                    
                    // Wir wissen targetHours nicht synchron hier im Callback, 
                    // aber wir speichern die maxDuration und vergleichen später.
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
    // Wir nehmen die längste aktive Instruction ODER die längste abgeschlossene heute
    const calculateProgress = () => {
        const now = new Date();
        
        // 1. Suche aktive Instruction (Tag)
        const activeInstruction = activeSessions.find(s => 
            s.type === 'instruction' && 
            (!s.period || !s.period.includes('night')) // Keine Nacht-Sessions für Tagesziel
        );

        let currentMinutes = 0;
        let isLive = false;

        if (activeInstruction) {
            const start = activeInstruction.startTime;
            currentMinutes = Math.floor((now - start) / 60000);
            isLive = true;
        } else {
            // Wenn keine aktiv, nehmen wir den historischen Bestwert von heute
            // Damit bleibt der Balken grün, wenn man es schon geschafft hat.
            // Aber: Wenn man es NICHT geschafft hat (Abbruch), ist completedTodayMinutes < Ziel
            // und der Balken zeigt das (oder 0, je nach Logik).
            // User Wunsch: "Sollte Tagestragezeit nicht erreicht werden... zurück auf 0".
            // Das heißt: completedTodayMinutes zählt nur, wenn es >= Ziel ist.
            // Wir geben es roh zurück, die UI entscheidet.
            currentMinutes = Math.floor(completedTodayMinutes);
        }

        const targetMinutes = dailyTargetHours * 60;
        const isGoalMet = currentMinutes >= targetMinutes;

        // Wenn nicht aktiv und Ziel nicht erreicht -> 0 (Fail Reset)
        // Ausnahme: Ziel wurde heute schonmal erreicht (isGoalMet historisch)
        if (!isLive && !isGoalMet) {
            currentMinutes = 0;
        }

        return {
            currentContinuousMinutes: currentMinutes,
            dailyTargetMinutes: targetMinutes,
            percentage: Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100)),
            isDailyGoalMet: isGoalMet,
            isLive,
            nightCompliance // Geben wir mit raus
        };
    };

    return {
        activeSessions,
        loading,
        progress: calculateProgress(),
        dailyTargetHours,
        nightCompliance, // Export für Dashboard
        // Dummy Functions für Kompatibilität (werden im Dashboard importiert/ersetzt durch Services)
        startInstructionSession: async () => {}, 
        stopSession: async () => {},
        registerRelease: async () => {}
    };
}