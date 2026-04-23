import { useState, useEffect, useCallback } from 'react';
import { getTZDStatus, checkForTZDTrigger, performCheckIn, startTZD } from '../../services/TZDService';
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
    // --- LOKALE STATES ---
    const [tzdActive, setTzdActive] = useState(false);
    const [tzdStartTime, setTzdStartTime] = useState(null); 
    const [isCheckingProtocol, setIsCheckingProtocol] = useState(true);
    
    // NEU: Reines Daten-Objekt statt UI-Store Flag (Entkopplung)
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

                    // AUTO-COMPLETE TZD (Beendet TZD automatisch, wenn Zeit inkl. Strafen abgelaufen ist)
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
                                // NEU: Nur Daten setzen. UI reagiert dynamisch.
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
        
        setGambleOffer(null); // Daten löschen schließt implizit das Fenster im Dashboard
        
        if (result.win) {
            if (showToast) showToast("GEWINN! 24h Immunität aktiviert.", "success");
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

            await startTZD(currentUser.uid, currentStake, null, 1440, 'spiel_tzd');
            if (showToast) showToast("VERLOREN. 24h Zeitloses Diktat aktiviert.", "error");
            setTzdActive(true);
            setTzdStartTime(new Date());
        }
    }, [currentUser, activeSessions, gambleOffer, showToast]);

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
        gambleOffer, // NEU: Datenübergabe statt Fenster-Trigger
        immunityActive,
        setImmunityActive,
        handleGambleAccept,
        handleGambleDecline
    };
}