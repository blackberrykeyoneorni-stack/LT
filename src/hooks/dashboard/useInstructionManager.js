// src/hooks/dashboard/useInstructionManager.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, doc, updateDoc, writeBatch, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateAndSaveInstruction, getLastInstruction } from '../../services/InstructionService';
import { triggerEvasionPenalty } from '../../services/TZDService';
import { startSession as startSessionService } from '../../services/SessionService';
import { registerRelease as apiRegisterRelease } from '../../services/ReleaseService';
import { registerOathRefusal, registerPunishment, getActivePunishment } from '../../services/PunishmentService';

// --- HILFSFUNKTIONEN ---
const getLocalISODate = (date) => { 
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const calculatePeriodId = (d = new Date()) => {
    const mins = d.getHours() * 60 + d.getMinutes();
    const isDay = mins >= 450 && mins < 1380;
    let dateStr = getLocalISODate(d);
    if (mins < 450) { 
        const y = new Date(d);
        y.setDate(y.getDate() - 1); dateStr = getLocalISODate(y); 
    }
    return `${dateStr}-${isDay ? 'day' : 'night'}`;
};
const checkIsHoliday = (date) => {
    const d = date.getDate(); const m = date.getMonth() + 1;
    if (m === 12 && (d === 24 || d === 25 || d === 26)) return true;
    if (m === 12 && d === 31) return true;
    if (m === 1 && d === 1) return true;
    return false;
};

export default function useInstructionManager({
    currentUser,
    items,
    activeSessions,
    sessionsLoading,
    isStealthActive,
    tzdActive,
    setTzdActive,
    showToast,
    setPunishmentStatus
}) {
    // --- LOKALE STATES ---
    const [now, setNow] = useState(Date.now());
    const [currentPeriod, setCurrentPeriod] = useState(calculatePeriodId());
    const [isFreeDay, setIsFreeDay] = useState(false);
    const [freeDayReason, setFreeDayReason] = useState('');
    
    const [instructionOpen, setInstructionOpen] = useState(false);
    const [currentInstruction, setCurrentInstruction] = useState(null);
    const [instructionStatus, setInstructionStatus] = useState('idle');
    
    const [oathProgress, setOathProgress] = useState(0);
    const [isHoldingOath, setIsHoldingOath] = useState(false);
    const [forcedReleaseOpen, setForcedReleaseOpen] = useState(false);
    const [forcedReleaseMethod, setForcedReleaseMethod] = useState(null);
// --- REFS FÜR TIMER UND LOGIK ---
    const oathTimerRef = useRef(null);
    const isJustStartedRef = useRef(false);
// --- ABGELEITETE STATES ---
    const isInstructionActive = activeSessions.some(s => s.type === 'instruction');
    const isNight = currentPeriod ? currentPeriod.includes('night') : false;

    // --- EFFECT 1: ZEIT-TICKER (Perioden und Feiertage berechnen) ---
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        const newPeriod = calculatePeriodId();
        if (newPeriod !== currentPeriod) setCurrentPeriod(newPeriod);
        const d = new Date(now);
        const day = d.getDay();
        const isWeekend = (day === 0 || day === 6);
        const isHoliday = checkIsHoliday(d);
        setIsFreeDay(isWeekend || isHoliday);
        setFreeDayReason(isHoliday ? 'Holiday' : (isWeekend ? 
'Weekend' : ''));
    }, [now, currentPeriod]);

    // --- EFFECT 2: INSTRUCTION LADEN ODER GENERIEREN ---
    useEffect(() => {
        if (!currentUser || items.length === 0 || sessionsLoading || !currentPeriod) return;

        const isIdle = instructionStatus === 'idle';
        const wrongPeriod = currentInstruction && currentInstruction.periodId !== currentPeriod;
        
        if ((isIdle || wrongPeriod) && instructionStatus !== 'loading') { 
      
       const check = async () => {
                setInstructionStatus('loading');
                try {
                    let instr = await getLastInstruction(currentUser.uid);
                    
           
         if (instr && instr.periodId === currentPeriod) {
                        if (instr.isAccepted && !instr.evasionPenaltyTriggered) {
                            const acceptedDate = instr.acceptedAt?.toDate ? instr.acceptedAt.toDate() : new Date(instr.acceptedAt);
                     
       const ageInMinutes = (new Date() - acceptedDate) / 60000;
                            
                            const qSession = query(
                          
       collection(db, `users/${currentUser.uid}/sessions`),
                                where('periodId', '==', instr.periodId),
                                where('type', '==', 'instruction')
                         
    );
                            const sessionSnap = await getDocs(qSession);
                            const hasEverStarted = !sessionSnap.empty;
if (ageInMinutes > 30 && !hasEverStarted) {
                                console.log("Flucht erkannt (Initial Check - Post Oath)! Trigger 150% TZD.");
await triggerEvasionPenalty(currentUser.uid, instr.items);
                                
                                await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { 
                                    evasionPenaltyTriggered: true 
                                });
setTzdActive(true); 
                                setInstructionOpen(false); 
                                instr = null;
                            }
                        }
                        if (instr) setCurrentInstruction(instr);
} else if (!isFreeDay || currentPeriod.includes('night') || isStealthActive) {
                        const newInstr = await generateAndSaveInstruction(currentUser.uid, items, activeSessions, currentPeriod);
setCurrentInstruction(newInstr);
                    } else {
                        setCurrentInstruction(null);
}
                } catch(e) { 
                    console.error("Instruction Load Error", e);
} finally { 
                    setInstructionStatus('ready');
}
            };
            check();
}
    }, [currentUser, items.length, sessionsLoading, currentPeriod, currentInstruction, instructionStatus, isFreeDay, activeSessions, isStealthActive, setTzdActive]);
// --- EFFECT 3: LIVE-WATCHER (Post-Oath Flucht) ---
    useEffect(() => {
        if (!currentUser || !currentInstruction || !currentInstruction.isAccepted || currentInstruction.evasionPenaltyTriggered) return;
        if (isInstructionActive) return; 

        const timer = setInterval(async () => {
            const acceptedDate = currentInstruction.acceptedAt?.toDate ? currentInstruction.acceptedAt.toDate() : new Date(currentInstruction.acceptedAt);
            const ageInMinutes = (Date.now() - acceptedDate) / 60000;

       
     if (ageInMinutes > 30) {
                const qSession = query(
                    collection(db, `users/${currentUser.uid}/sessions`),
                    where('periodId', '==', currentInstruction.periodId),
                    where('type', '==', 'instruction')
       
         );
                const sessionSnap = await getDocs(qSession);

                if (sessionSnap.empty) {
                    console.log("Flucht erkannt (Live Watcher - Post Oath)!\nTrigger 150% TZD.");
                    
                    setCurrentInstruction(prev => ({ ...prev, evasionPenaltyTriggered: true }));
                    setInstructionOpen(false);

                    await triggerEvasionPenalty(currentUser.uid, currentInstruction.items);
          
          
                    await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { 
                        evasionPenaltyTriggered: true
                    });
                    
 
                    setTzdActive(true); 
                    if (showToast) showToast("Zeitüberschreitung nach Eid: Strafe eingeleitet.", "error");
                }
                clearInterval(timer);
            }
        }, 
60000); 

        return () => clearInterval(timer);
    }, [currentUser, currentInstruction, isInstructionActive, setTzdActive, showToast]);

// --- EFFECT 4: FORCED RELEASE VERZÖGERUNGS-TRIGGER ---
    useEffect(() => {
        if (isInstructionActive && currentInstruction) {
            const activeInstSession = activeSessions.find(s => s.type === 'instruction');
            const fr = currentInstruction.forcedRelease;
            
            if (fr && fr.required === true && fr.executed === false && activeInstSession?.startTime) {
                if (!forcedReleaseOpen) {
                    // Reale Berechnung auf Basis der DB-Zeit, robuster 5-Sekunden-Trigger
                    const startMs = activeInstSession.startTime?.toDate ? activeInstSession.startTime.toDate().getTime() : new Date(activeInstSession.startTime).getTime();
                    const nowMs = Date.now();
                    const elapsed = nowMs - startMs;
                    const delay = Math.max(0, 5000 - elapsed);
                    
                    const timerId = setTimeout(() => {
                        setForcedReleaseMethod(fr.method);
                        setForcedReleaseOpen(true);
                        isJustStartedRef.current = false; 
                    }, delay);
                    return () => clearTimeout(timerId);
                }
            }
        }
    }, [isInstructionActive, currentInstruction, forcedReleaseOpen, activeSessions]);
// --- HANDLER: SESSION START ---
    const handleStartRequest = useCallback(async (itemsToStart) => { 
        if (!currentUser) return;
        if (tzdActive) { 
            if (showToast) showToast("ZUGRIFF VERWEIGERT: Zeitloses Diktat aktiv.", "error"); 
            return; 
        }
        const targetItems = itemsToStart || currentInstruction?.items;
        if 
(targetItems && targetItems.length > 0) { 
            isJustStartedRef.current = true;
            
            await startSessionService(currentUser.uid, {
              items: targetItems,
              type: 'instruction',
              periodId: currentInstruction.periodId,
         
     acceptedAt: currentInstruction.acceptedAt
            });
            
            setInstructionOpen(false); 
            if (showToast) showToast(`${targetItems.length} Sessions gestartet.`, "success");
        }
    }, [currentUser, tzdActive, currentInstruction, showToast]);
// --- HANDLER: OATH (EID) LOGIK ---
    const handleAcceptOath = useCallback(async () => { 
        if (!currentUser) return;
        const nowISO = new Date().toISOString(); 
        const batch = writeBatch(db); 
        batch.update(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { isAccepted: true, acceptedAt: nowISO }); 
        await batch.commit(); 
        setCurrentInstruction(prev => ({ ...prev, isAccepted: true, acceptedAt: nowISO })); 
     
   setIsHoldingOath(false); 
    }, [currentUser]);
const startOathPress = useCallback(() => { 
        setIsHoldingOath(true); 
        setOathProgress(0); 
        oathTimerRef.current = setInterval(() => { 
            setOathProgress(prev => { 
                if (prev >= 100) { 
                    clearInterval(oathTimerRef.current); 
      
              handleAcceptOath(); 
                    return 100; 
                } 
                return prev + 0.4; 
            }); 
        }, 20); 
   
 }, [handleAcceptOath]);
    
    const cancelOathPress = useCallback(() => { 
        clearInterval(oathTimerRef.current); 
        setIsHoldingOath(false); 
        setOathProgress(0); 
    }, []);
const handleDeclineOath = useCallback(async () => { 
        if (!currentUser) return;
        await registerOathRefusal(currentUser.uid); 
        const newPunishment = await getActivePunishment(currentUser.uid);
        if (setPunishmentStatus) setPunishmentStatus(newPunishment || { active: false }); 
        setInstructionOpen(false); 
        setIsHoldingOath(false); 
    }, [currentUser, setPunishmentStatus]);
// --- HANDLER: FORCED RELEASE ---
const handleConfirmForcedRelease = useCallback(async (outcome) => {
        if (!currentUser) return;
        try {
            const activeInstSession = activeSessions.find(s => s.type === 'instruction');
            await apiRegisterRelease(currentUser.uid, 'maintained', 5, 'clean');
            
            const batch = writeBatch(db);
            batch.update(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { "forcedRelease.executed": true });
            
            // POST-NUT CLARITY: Injektion des Entladungs-Zeitpunkts in die Session
            if (activeInstSession) {
                batch.update(doc(db, `users/${currentUser.uid}/sessions`, activeInstSession.id), { 
                    forcedReleaseAt: serverTimestamp() 
                });
            }
            
            await batch.commit();

            setCurrentInstruction(prev => ({ ...prev, forcedRelease: { ...prev.forcedRelease, executed: true } }));
            setForcedReleaseOpen(false);
            if (showToast) showToast("Protokoll erfüllt. Sauber und gehorsam.", "success");
        } catch (e) {
            console.error("Error confirming forced release:", e);
            if (showToast) showToast("Fehler beim Speichern.", "error");
        }
    }, [currentUser, activeSessions, showToast]);
const handleFailForcedRelease = useCallback(async () => {
        if (!currentUser) return;
        try {
            await registerPunishment(currentUser.uid, "Schwäche: Zwangsentladung fehlgeschlagen (Item ruiniert)", 60);
            const newStatus = await getActivePunishment(currentUser.uid);
            if (setPunishmentStatus) setPunishmentStatus(newStatus || { active: false });
            
         
   const batch = writeBatch(db);
            if (currentInstruction && currentInstruction.items) {
                currentInstruction.items.forEach(item => {
                    batch.update(doc(db, `users/${currentUser.uid}/items`, item.id), { status: 'washing' });
                });
            }
      
      
            batch.update(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { "forcedRelease.executed": true });
            await batch.commit();
  
            setCurrentInstruction(prev => ({ ...prev, forcedRelease: { ...prev.forcedRelease, executed: true } }));
setForcedReleaseOpen(false);
            if (showToast) showToast("Schwäche protokolliert. Ausrüstung ruiniert. Strafe aktiv.", "error");
} catch (e) {
            console.error("Error failing forced release:", e);
}
    }, [currentUser, currentInstruction, setPunishmentStatus, showToast]);
  
    const handleRefuseForcedRelease = useCallback(async () => {
        if (!currentUser) return;
        try {
            await registerPunishment(currentUser.uid, "Not-Abbruch Zwangsentladung verweigert", 120);
            const newStatus = await getActivePunishment(currentUser.uid);
            if (setPunishmentStatus) setPunishmentStatus(newStatus || { active: false });
            
  
          await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { "forcedRelease.executed": true });
            setCurrentInstruction(prev => ({ ...prev, forcedRelease: { ...prev.forcedRelease, executed: true } }));
            setForcedReleaseOpen(false);
            if (showToast) showToast("Verweigerung registriert. Massive Strafe aktiv.", "warning");
        } catch (e) {
            console.error("Error refusing forced release:", e);
    
    }
    }, [currentUser, setPunishmentStatus, showToast]);
// --- RÜCKGABE DES VERTRAGS ---
    return {
        currentPeriod,
        isNight,
        isFreeDay,
        freeDayReason,
        instructionOpen,
        setInstructionOpen,
        currentInstruction,
        instructionStatus,
        isInstructionActive,
        oathProgress,
        isHoldingOath,
  
      forcedReleaseOpen,
        forcedReleaseMethod,
        handleStartRequest,
        startOathPress,
        cancelOathPress,
        handleDeclineOath,
        handleConfirmForcedRelease,
        handleFailForcedRelease,
        handleRefuseForcedRelease: handleFailForcedRelease // Redirection auf Versagen nach Anforderung
    };
}