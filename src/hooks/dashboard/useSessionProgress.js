import { useState, useEffect, useRef } from 'react';
import { 
    collection, query, where, getDocs, orderBy, limit, doc, getDoc, onSnapshot 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { calculateDurationMinutes } from '../../utils/dateUtils';
import { startSession, stopSession as serviceStopSession } from '../../services/SessionService';
import { checkReleaseOutcome } from '../../services/ReleaseService';

export default function useSessionProgress(currentUser, items) {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dailyTargetHours, setDailyTargetHours] = useState(4); // Default 4h
    
    // Progress State
    const [progress, setProgress] = useState({
        currentContinuousMinutes: 0,
        percentage: 0,
        isDailyGoalMet: false,
        isNightLocked: false,
        nightStatus: 'unknown'
    });

    // Refs für Timer
    const timerRef = useRef(null);

    // 1. Initial Load & Listeners
    useEffect(() => {
        if (!currentUser) return;

        setLoading(true);

        // A. Load Settings (Target)
        const fetchSettings = async () => {
            try {
                const sRef = doc(db, `users/${currentUser.uid}/settings/preferences`);
                const sSnap = await getDoc(sRef);
                if (sSnap.exists()) {
                    setDailyTargetHours(sSnap.data().dailyTargetHours || 4);
                }
            } catch (e) {
                console.error("Settings load error", e);
            }
        };

        fetchSettings();

        // B. Realtime Listener for Active Sessions
        const qActive = query(
            collection(db, `users/${currentUser.uid}/sessions`),
            where('endTime', '==', null)
        );

        const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
            const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Startzeiten normalisieren
            const processed = sessions.map(s => ({
                ...s,
                startTime: s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime)
            }));
            setActiveSessions(processed);
        });

        // C. Check Daily Instruction Status & Night History
        // Wir hören auf das Dokument des HEUTIGEN Tages
        const checkStatus = async () => {
            try {
                // 1. Check Night Status (vom VORHERIGEN Zyklus)
                // Annahme: Wir prüfen, ob die letzte Nacht erfolgreich war.
                // Wir holen die letzte "night" Period Instruction oder den generellen Status.
                // Hier vereinfacht: Wir schauen in den allgemeinen Status/History.
                // Falls keine explizite History da ist, prüfen wir den 'lastNightCheck' im User Status
                
                let nightLocked = false;
                let nightStat = 'fulfilled'; // Default optimistisch, außer wir finden einen Fail

                // Hole letzte Instruktion (sortiert nach Datum)
                const instrRef = collection(db, `users/${currentUser.uid}/instructions`);
                const qInstr = query(instrRef, orderBy('createdAt', 'desc'), limit(5));
                const instrSnap = await getDocs(qInstr);
                
                const instructions = instrSnap.docs.map(d => d.data());
                // Suche die letzte NACHT-Instruktion
                const lastNight = instructions.find(i => i.periodId && i.periodId.includes('night'));

                if (lastNight) {
                    // Wenn die letzte Nacht existiert, prüfen wir das Ergebnis
                    if (lastNight.result === 'failed') {
                        nightLocked = true;
                        nightStat = 'failed';
                    } else if (!lastNight.isAccepted && !lastNight.result) {
                        // Nacht noch offen oder nicht akzeptiert -> Sperren bis geklärt
                        // (Kann je nach Logik auch offen bleiben)
                    }
                }

                // 2. Check Daily Goal Status (Heute)
                const todayRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
                const todaySnap = await getDoc(todayRef);
                let goalMet = false;
                
                if (todaySnap.exists()) {
                    const data = todaySnap.data();
                    if (data.isMet) goalMet = true;
                }

                setProgress(prev => ({
                    ...prev,
                    isDailyGoalMet: goalMet,
                    isNightLocked: nightLocked,
                    nightStatus: nightStat
                }));

                setLoading(false);

            } catch (e) {
                console.error("Status check error", e);
                setLoading(false);
            }
        };

        checkStatus();

        return () => {
            unsubscribeActive();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [currentUser]);

    // 2. Calculation Loop (Jede Minute)
    useEffect(() => {
        const calculateProgress = () => {
            if (progress.isNightLocked) {
                setProgress(p => ({ ...p, currentContinuousMinutes: 0, percentage: 0 }));
                return;
            }

            if (progress.isDailyGoalMet) {
                // Wenn Ziel erreicht, bleibe bei 100% (bzw. Zielwert)
                setProgress(p => ({ 
                    ...p, 
                    currentContinuousMinutes: dailyTargetHours * 60, 
                    percentage: 100 
                }));
                return;
            }

            // STRIKTE LOGIK:
            // Fortschritt nur, wenn eine Instruction-Session läuft UND alle Items getragen werden.
            // Sobald unterbrochen -> 0 (außer Ziel schon erreicht, siehe oben).

            const instructionSession = activeSessions.find(s => s.type === 'instruction');

            if (!instructionSession) {
                // KEINE Session aktiv -> Reset auf 0 (Vorgabe: "Stückelung ausgeschlossen")
                setProgress(p => ({ 
                    ...p, 
                    currentContinuousMinutes: 0, 
                    percentage: 0 
                }));
                return;
            }

            // Validierung: Sind alle Items aktiv?
            // Bei type='instruction' gehen wir davon aus, dass die Session für alle Items gilt.
            // Sollte man einzelne Items stoppen können, müsste hier geprüft werden, ob
            // instructionSession.itemIds noch vollständig in activeSessions vorhanden sind.
            // Wir nehmen hier an: Die Session selbst repräsentiert den Verbund.

            const now = new Date();
            const start = instructionSession.startTime;
            const durationMinutes = Math.floor((now - start) / 60000); // ms -> min

            // Begrenzung auf 0 (keine negative Zeit)
            const safeMinutes = Math.max(0, durationMinutes);
            
            // Prozentberechnung
            const targetMin = dailyTargetHours * 60;
            const pct = Math.min(100, (safeMinutes / targetMin) * 100);

            // Update
            setProgress(p => ({
                ...p,
                currentContinuousMinutes: safeMinutes,
                percentage: pct
            }));
            
            // Check Goal Reached (Auto-Trigger)
            if (safeMinutes >= targetMin && !progress.isDailyGoalMet) {
                handleGoalMet();
            }
        };

        // Sofort berechnen
        calculateProgress();

        // Interval starten
        timerRef.current = setInterval(calculateProgress, 60000); // Jede Minute Update

        return () => clearInterval(timerRef.current);
    }, [activeSessions, dailyTargetHours, progress.isDailyGoalMet, progress.isNightLocked]);


    // Helper: Goal Met speichern
    const handleGoalMet = async () => {
        if (!currentUser) return;
        try {
            const todayRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
            await updateDoc(todayRef, { isMet: true, metAt: new Date().toISOString() });
            setProgress(p => ({ ...p, isDailyGoalMet: true, percentage: 100 }));
        } catch(e) { console.error(e); }
    };

    // Actions
    const startInstructionSession = async (instruction) => {
        if (progress.isNightLocked) throw new Error("Gesperrt durch Nacht-Fail");
        // Startet Session für alle Items
        // Logik wird im SessionService gehandhabt, hier nur Wrapper
        // WICHTIG: Das Frontend muss sicherstellen, dass vorher gestoppt wurde oder dies hier handled
        // Wir nehmen an: ActionButtons handled das Starten.
        // Hier nur Reload trigger.
    };

    const stopSession = async (session, feedback) => {
        await serviceStopSession(currentUser.uid, session.id, feedback);
        // Progress wird durch Listener und calculateProgress automatisch auf 0 gesetzt
    };

    const registerRelease = async (outcome, intensity) => {
        return await checkReleaseOutcome(currentUser.uid, outcome, intensity);
    };

    return {
        activeSessions,
        progress,
        loading,
        dailyTargetHours,
        startInstructionSession,
        stopSession,
        registerRelease
    };
}