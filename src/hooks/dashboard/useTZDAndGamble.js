import { useState, useEffect, useCallback } from 'react';
import { getTZDStatus, checkForTZDTrigger, performCheckIn, startTZD, getTZDSettings } from '../../services/TZDService';
import { checkGambleTrigger, rollTheDice, recordGambleAction, setImmunity } from '../../services/OfferService';
import { stopSession as stopSessionService } from '../../services/SessionService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

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
    const [immunityActive, setImmunityActive] = useState(false);

    // --- ABGELEITETE STATES ---
    const isInstructionActive = activeSessions.some(s => s.type === 'instruction' && s.instructionReadyTime);

    // --- EFFECT 1: PERSISTENT GAMBLE LISTENER ---
    // Zwingt den Dialog unerbittlich auf den Bildschirm, solange ein aktives Gamble in der Datenbank liegt
    useEffect(() => {
        if (!currentUser) return;
        const statsRef = doc(db, `users/${currentUser.uid}/status/gambleStats`);
        
        const unsubscribe = onSnapshot(statsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.activeGamble) {
                    setGambleOffer(data.activeGamble);
                } else {
                    setGambleOffer(null);
                }
            }
        });
        return () => unsubscribe();
    }, [currentUser]);


    // --- EFFECT 2: TZD Check + GAMBLE TRIGGER (5-Minuten-Auditor) ---
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
                    
                    // Trigger-Logik: Nur versuchen, wenn KEIN Gamble offen ist
                    if (!gambleOffer && items.length > 0 && !isStealthActive) {
                        const activePunishItem = punishmentStatus.active ? punishmentItem : null;
                        // Übergebe items an checkGambleTrigger für die Backend-Verankerung
                        await checkGambleTrigger(currentUser.uid, false, isInstructionActive, activePunishItem, items);
                        // Der State-Update von gambleOffer geschieht vollautomatisch durch EFFECT 1
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
    }, [currentUser, items, activeSessions, itemsLoading, tzdActive, isInstructionActive, gambleOffer, punishmentStatus, punishmentItem, isStealthActive, showToast]);

    // --- HANDLERS: GAMBLE ---
    const handleGambleAccept = useCallback(async () => {
        if (!currentUser || !gambleOffer) return;
        
        // Lokale Sperre, Backend Update
        const currentStake = gambleOffer.stake || [];
        await recordGambleAction(currentUser.uid, 'accept'); 
        
        const result = await rollTheDice(currentUser.uid, currentStake);
        
        if (result.win) {
            // GEWINN: Immunität vergeben
            const { maxHours } = await getTZDSettings(currentUser.uid);
            const immunityHours = maxHours * 2;
            
            await setImmunity(currentUser.uid, immunityHours);
            if (showToast) showToast(`GEWINN! ${immunityHours}h Immunität aktiviert.`, "success");
            setImmunityActive(true);
        } else {
            // VERLUST: Optionale Voluntary Sessions hart beenden
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

            // Das TZD wurde von rollTheDice bereits in die Datenbank geschrieben
            if (showToast) showToast("VERLOREN. Zeitloses Diktat aktiviert.", "error");
            setTzdActive(true);
            setTzdStartTime(new Date());
        }
    }, [currentUser, activeSessions, gambleOffer, showToast, setImmunityActive]);

    const handleGambleDecline = useCallback(async () => {
        if (!currentUser) return;
        await recordGambleAction(currentUser.uid, 'decline'); // Backend räumt auf
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