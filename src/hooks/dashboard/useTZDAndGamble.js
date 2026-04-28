import { useState, useEffect, useCallback } from 'react';
import { getTZDStatus, checkForTZDTrigger, performCheckIn, startTZD, getTZDSettings } from '../../services/TZDService';
import { checkGambleTrigger, determineGambleStake, rollTheDice, recordGambleAction, setImmunity } from '../../services/OfferService';
import { stopSession as stopSessionService } from '../../services/SessionService';

export default function useTZDAndGamble({
    currentUser,
    items,
    itemsLoading,
    activeSessions,
    punishmentStatus,
    punishmentItem,
    isStealthActive,
    showToast
}) {
    // --- LOKALE STATES ---
    const [tzdActive, setTzdActive] = useState(false);
    const [tzdStartTime, setTzdStartTime] = useState(null); 
    const [isCheckingProtocol, setIsCheckingProtocol] = useState(true);
    
    const [gambleOffer, setGambleOffer] = useState(null);
    const [hasGambledThisSession, setHasGambledThisSession] = useState(false);
    const [immunityActive, setImmunityActive] = useState(false);

    // --- ABGELEITETE STATES ---
    const isInstructionActive = activeSessions.some(s => s.type === 'instruction' && s.instructionReadyTime);

    // --- EFFECT: TZD Check + GAMBLE TRIGGER (5-Minuten-Auditor) ---
    useEffect(() => {
        let interval;
        const checkTZD = async () => {
            if (!currentUser || itemsLoading) return;
            
            try {
                const status = await getTZDStatus(currentUser.uid);
                
                if (status.isActive) { 
                    if (!tzdActive) {
                        setTzdActive(true);
                        if(status.startTime) setTzdStartTime(status.startTime);
                    }

                    // AUTO-COMPLETE TZD
                    if (status.stage === 'running' && status.startTime) {
                        const elapsed = Math.floor((Date.now() - status.startTime.getTime()) / 60000);
                        if (elapsed >= status.targetDurationMinutes) {
                            const checkInResult = await performCheckIn(currentUser.uid, status);
                            if (checkInResult && checkInResult.completed) {
                                setTzdActive(false);
                                setTzdStartTime(null);
                                if (showToast) showToast("Zeitloses Diktat automatisch beendet.", "success");
                            }
                        }
                    }
                } else { 
                    if (tzdActive) {
                        setTzdActive(false); 
                        setTzdStartTime(null);
                    }
                    
                    if (!hasGambledThisSession && items.length > 0 && !isStealthActive) {
                        const activePunishItem = punishmentStatus.active ? punishmentItem : null;
                        const gambleResult = await checkGambleTrigger(currentUser.uid, false, isInstructionActive, activePunishItem);
                        if (gambleResult.trigger) {
                            const stake = determineGambleStake(items);
                            if (stake.length > 0) {
                                setGambleOffer({ stake, isForced: gambleResult.isForced });
                                setHasGambledThisSession(true);
                            }
                        } else {
                            setHasGambledThisSession(true);
                        }
                    }

                    if (isInstructionActive && !isStealthActive) { 
                        const triggered = await checkForTZDTrigger(currentUser.uid, activeSessions, items);
                        if (triggered) {
                            setTzdActive(true);
                            setTzdStartTime(new Date()); 
                        }
                    } 
                }
            } catch (e) {
                console.error("TZD Check Error", e);
            } finally {
                setIsCheckingProtocol(false);
            }
        };

        if (currentUser && !itemsLoading) { 
            checkTZD();
            interval = setInterval(checkTZD, 300000); 
        }
        return () => clearInterval(interval);
    }, [currentUser, items, activeSessions, itemsLoading, tzdActive, isInstructionActive, hasGambledThisSession, punishmentStatus, punishmentItem, isStealthActive, showToast]);

    // --- HANDLERS: GAMBLE ---
    const handleGambleAccept = useCallback(async () => {
        if (!currentUser) return;
        await recordGambleAction(currentUser.uid, 'accept');
        const currentStake = gambleOffer?.stake || [];
        const result = await rollTheDice(currentUser.uid, currentStake);
        
        setGambleOffer(null); 
        
        if (result.win) {
            // NEU: Gewinn ist das doppelte der in den Settings definierten maxHours des TZD
            const { maxHours } = await getTZDSettings(currentUser.uid);
            const immunityHours = maxHours * 2;
            
            await setImmunity(currentUser.uid, immunityHours);
            if (showToast) showToast(`GEWINN! ${immunityHours}h Immunität aktiviert.`, "success");
            setImmunityActive(true);
        } else {
            const voluntarySessions = activeSessions.filter(s => s.type === 'voluntary' && !s.endTime);
            
            if (voluntarySessions.length > 0) {
                try {
                    const stopPromises = voluntarySessions.map(s => 
                        stopSessionService(currentUser.uid, s.id, { 
                            feelings: ['System Override'], 
                            note: 'Zwangsabbruch durch Gamble-Verlust (System Override).' 
                        })
                    );
                    await Promise.all(stopPromises);
                    if (showToast) showToast(`${voluntarySessions.length} Session(s) durch Protokoll überschrieben.`, "warning");
                } catch (e) { console.error(e); }
            }

            // NEU: Das universelle, absolut unberechenbare TZD wird gestartet (Option A)
            await startTZD(currentUser.uid, currentStake);
            
            if (showToast) showToast("VERLOREN. Zeitloses Diktat aktiviert.", "error");
            setTzdActive(true);
            setTzdStartTime(new Date());
        }
    }, [currentUser, activeSessions, gambleOffer, showToast, setImmunityActive]);

    const handleGambleDecline = useCallback(async () => {
        if (!currentUser) return;
        await recordGambleAction(currentUser.uid, 'decline');
        setGambleOffer(null);
        if (showToast) showToast("Sicher ist sicher...", "info");
    }, [currentUser, showToast]);

    // --- RÜCKGABE DES VERTRAGS ---
    return {
        tzdActive,
        setTzdActive,
        isCheckingProtocol,
        gambleOffer, 
        immunityActive,
        setImmunityActive,
        handleGambleAccept,
        handleGambleDecline
    };
}