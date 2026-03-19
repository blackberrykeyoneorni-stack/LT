// src/hooks/dashboard/useTZDAndGamble.js
import { useState, useEffect, useCallback } from 'react';
import { getTZDStatus, checkForTZDTrigger, performCheckIn } from '../../services/TZDService';
import { checkGambleTrigger, determineGambleStake, rollTheDice, recordGambleAction } from '../../services/OfferService';
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
    const [tzdActive, setTzdActive] = useState(false);
    const [tzdStartTime, setTzdStartTime] = useState(null); 
    const [isCheckingProtocol, setIsCheckingProtocol] = useState(true); 
    
    const [offerOpen, setOfferOpen] = useState(false);
    const [gambleStake, setGambleStake] = useState([]);
    const [isForcedGamble, setIsForcedGamble] = useState(false);
    const [hasGambledThisSession, setHasGambledThisSession] = useState(false);
    const [immunityActive, setImmunityActive] = useState(false);

    const safeActiveSessions = activeSessions || [];
    const isInstructionActive = safeActiveSessions.some(s => s.type === 'instruction');

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
                    
                    if (!hasGambledThisSession && items && items.length > 0 && !isStealthActive) {
                        const activePunishItem = punishmentStatus.active ? punishmentItem : null;
                        const gambleResult = await checkGambleTrigger(currentUser.uid, false, isInstructionActive, activePunishItem);
                        if (gambleResult.trigger) {
                            const stake = determineGambleStake(items);
                            if (stake && stake.length > 0) {
                                setGambleStake(stake);
                                setIsForcedGamble(gambleResult.isForced);
                                setOfferOpen(true);
                                setHasGambledThisSession(true);
                            }
                        } else {
                            setHasGambledThisSession(true); 
                        }
                    }

                    if (isInstructionActive && !isStealthActive) { 
                        const triggered = await checkForTZDTrigger(currentUser.uid, safeActiveSessions, items); 
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
    }, [currentUser, items, safeActiveSessions, itemsLoading, tzdActive, isInstructionActive, hasGambledThisSession, punishmentStatus, punishmentItem, isStealthActive, showToast]);

    const handleGambleAccept = useCallback(async () => {
        if (!currentUser) return;
        await recordGambleAction(currentUser.uid, 'accept');
        const result = await rollTheDice(currentUser.uid, gambleStake);
        setOfferOpen(false);
        
        if (result.win) {
            if (showToast) showToast("GEWINN! 24h Immunität aktiviert.", "success");
            setImmunityActive(true);
        } else {
            const voluntarySessions = safeActiveSessions.filter(s => s.type === 'voluntary' && !s.endTime);
            
            if (voluntarySessions.length > 0) {
                try {
                    // KORREKTUR: Absicherung von .map() zur Vermeidung von Fehlern im Execution-Stack
                    const stopPromises = (voluntarySessions || []).map(s => 
                        stopSessionService(currentUser.uid, s.id, { 
                            feelings: ['System Override'], 
                            note: 'Zwangsabbruch durch Gamble-Verlust (System Override).' 
                        })
                    );
                    await Promise.all(stopPromises);
                    if (showToast) showToast(`${voluntarySessions.length} Session(s) durch Protokoll überschrieben.`, "warning");
                } catch (e) { console.error(e); }
            }

            if (showToast) showToast("VERLOREN. Zeitloses Diktat aktiviert.", "error");
            setTzdActive(true);
            setTzdStartTime(new Date());
        }
    }, [currentUser, safeActiveSessions, gambleStake, showToast]);

    const handleGambleDecline = useCallback(async () => {
        if (!currentUser) return;
        await recordGambleAction(currentUser.uid, 'decline');
        setOfferOpen(false);
        if (showToast) showToast("Sicher ist sicher...", "info");
    }, [currentUser, showToast]);

    return {
        tzdActive,
        setTzdActive,
        isCheckingProtocol,
        offerOpen,
        gambleStake,
        isForcedGamble,
        immunityActive,
        setImmunityActive,
        handleGambleAccept,
        handleGambleDecline
    };
}