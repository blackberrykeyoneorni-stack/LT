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
    const dateStr = getLocalISODate(d);
    return isDay ? `${dateStr}_day` : `${dateStr}_night`;
};

export default function useInstructionManager({ 
    currentUser, items, punishmentStatus, setPunishmentStatus, activeSessions, tzdActive, setTzdActive, showToast 
}) {
    const [currentPeriod, setCurrentPeriod] = useState(calculatePeriodId());
    const [isNight, setIsNight] = useState(false);
    const [isFreeDay, setIsFreeDay] = useState(false);
    const [freeDayReason, setFreeDayReason] = useState(null);

    const [instructionOpen, setInstructionOpen] = useState(false);
    const [currentInstruction, setCurrentInstruction] = useState(null);
    const [instructionStatus, setInstructionStatus] = useState('idle'); 

    const [oathProgress, setOathProgress] = useState(0);
    const [isHoldingOath, setIsHoldingOath] = useState(false);
    const oathTimerRef = useRef(null);

    const [forcedReleaseOpen, setForcedReleaseOpen] = useState(false);
    const [forcedReleaseMethod, setForcedReleaseMethod] = useState(null);

    const isJustStartedRef = useRef(false);
    const isInstructionActive = activeSessions.some(s => s.type === 'instruction');

    // --- EFFECT 1: PERIODE & NACHT-CHECK ---
    useEffect(() => {
        const checkPeriod = () => {
            const d = new Date();
            const newPeriod = calculatePeriodId(d);
            if (newPeriod !== currentPeriod) setCurrentPeriod(newPeriod);
            
            const mins = d.getHours() * 60 + d.getMinutes();
            setIsNight(mins < 450 || mins >= 1380);
        };
        checkPeriod();
        const interval = setInterval(checkPeriod, 60000);
        return () => clearInterval(interval);
    }, [currentPeriod]);

    // --- EFFECT 2: VERTRAG LADEN / GENERIEREN ---
    useEffect(() => {
        if (!currentUser || !items || items.length === 0 || tzdActive) return;

        const loadOrGenerateInstruction = async () => {
            try {
                setInstructionStatus('loading');
                const existing = await getLastInstruction(currentUser.uid);

                if (existing && existing.periodId === currentPeriod) {
                    if (existing.isFreeDay) {
                        setIsFreeDay(true);
                        setFreeDayReason(existing.freeDayReason);
                        setInstructionStatus('ready');
                        return;
                    }
                    setIsFreeDay(false);
                    setCurrentInstruction(existing);
                    if (!existing.isAccepted && !isInstructionActive && !punishmentStatus?.active) {
                        setInstructionOpen(true);
                    }
                    setInstructionStatus('ready');
                } else {
                    if (punishmentStatus?.active) {
                        setInstructionStatus('blocked_punishment');
                        return;
                    }
                    if (isInstructionActive) return; 

                    const newInstr = await generateAndSaveInstruction(currentUser.uid, currentPeriod, items, isNight);
                    if (newInstr.isFreeDay) {
                        setIsFreeDay(true);
                        setFreeDayReason(newInstr.freeDayReason);
                    } else {
                        setIsFreeDay(false);
                        setCurrentInstruction(newInstr);
                        setInstructionOpen(true);
                    }
                    setInstructionStatus('ready');
                }
            } catch (e) {
                console.error("Error with Instruction:", e);
                setInstructionStatus('error');
            }
        };

        loadOrGenerateInstruction();
    }, [currentUser, currentPeriod, items, punishmentStatus, isInstructionActive, tzdActive, isNight]);

    // --- EFFECT 3: EVASION PENALTY (Verweigerung durch Nicht-Akzeptieren) ---
    useEffect(() => {
        if (!currentUser || !currentInstruction || currentInstruction.isAccepted || isInstructionActive) return;
        
        const checkEvasion = async () => {
            const genTime = currentInstruction.generatedAt?.toDate ? currentInstruction.generatedAt.toDate() : new Date(currentInstruction.generatedAt);
            if (Date.now() - genTime.getTime() > 15 * 60 * 1000) {
                await triggerEvasionPenalty(currentUser.uid);
                setInstructionOpen(false);
                setTzdActive(true);
                if (showToast) showToast("EVASION PENALTY: Vertrag ignoriert. Zeitloses Diktat initiiert.", "error");
            }
        };

        const interval = setInterval(checkEvasion, 60000);
        return () => clearInterval(interval);
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
        if (targetItems && targetItems.length > 0) { 
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