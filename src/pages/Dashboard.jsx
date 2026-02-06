import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, doc, updateDoc, serverTimestamp, 
  addDoc, arrayUnion, writeBatch, getDoc, onSnapshot 
} from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { motion } from 'framer-motion'; 

// Services
import { checkActiveSuspension } from '../services/SuspensionService';
import { isAuditDue, initializeAudit, confirmAuditItem } from '../services/AuditService';
import { getActivePunishment, clearPunishment, findPunishmentItem, registerOathRefusal, registerPunishment } from '../services/PunishmentService';
import { loadMonthlyBudget } from '../services/BudgetService';
import { generateAndSaveInstruction, getLastInstruction } from '../services/InstructionService';
import { checkForTZDTrigger, getTZDStatus, triggerEvasionPenalty } from '../services/TZDService';
import { registerRelease as apiRegisterRelease } from '../services/ReleaseService'; 
import { startSession as startSessionService, stopSession as stopSessionService } from '../services/SessionService';
import { checkGambleTrigger, determineGambleStake, rollTheDice, isImmunityActive } from '../services/OfferService';

// Hooks
import useSessionProgress from '../hooks/dashboard/useSessionProgress';
import useFemIndex from '../hooks/dashboard/useFemIndex'; 
import { useKPIs } from '../hooks/useKPIs'; 

// Components
import TzdOverlay from '../components/dashboard/TzdOverlay'; 
import ForcedReleaseOverlay from '../components/dashboard/ForcedReleaseOverlay';
import OfferDialog from '../components/dialogs/OfferDialog'; 
import ProgressBar from '../components/dashboard/ProgressBar';
import FemIndexBar from '../components/dashboard/FemIndexBar';
import ActionButtons from '../components/dashboard/ActionButtons';
import ActiveSessionsList from '../components/dashboard/ActiveSessionsList';
import InfoTiles from '../components/dashboard/InfoTiles';
import InstructionDialog from '../components/dialogs/InstructionDialog';
import ReleaseProtocolDialog from '../components/dialogs/ReleaseProtocolDialog';
import PunishmentDialog from '../components/dialogs/PunishmentDialog';
import LaundryDialog from '../components/dialogs/LaundryDialog';

import { DESIGN_TOKENS, PALETTE, MOTION } from '../theme/obsidianDesign';
import { 
    Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, 
    Snackbar, Alert, FormGroup, FormControlLabel, Checkbox, TextField, 
    Button, Container, Paper, Chip, LinearProgress, Divider 
} from '@mui/material';
import { Icons } from '../theme/appIcons';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import TimerIcon from '@mui/icons-material/Timer';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LockIcon from '@mui/icons-material/Lock'; 
import ShieldIcon from '@mui/icons-material/Shield'; 

const REFLECTION_TAGS = [
    "Sicher / Geborgen", "Erregt", "Gedemütigt", "Exponiert / Öffentlich", 
    "Feminin", "Besitztum (Owned)", "Unwürdig", "Stolz"
];

// --- HILFSFUNKTIONEN ---
const getLocalISODate = (date) => { 
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const calculatePeriodId = () => {
    const d = new Date(); 
    const mins = d.getHours() * 60 + d.getMinutes(); 
    const isDay = mins >= 450 && mins < 1380;
    let dateStr = getLocalISODate(d);
    if (mins < 450) { 
        const y = new Date(d); y.setDate(y.getDate() - 1); dateStr = getLocalISODate(y); 
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

// --- SUB-KOMPONENTE ---
const IndexDetailDialog = ({ open, onClose, details }) => {
    if (!details) return null;
    const renderMetricRow = (label, value, color, icon) => (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{icon}<Typography variant="body2" color="text.secondary">{label}</Typography></Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: color }}>{Math.round(value)}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={value} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
        </Box>
    );
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}><AnalyticsIcon color="primary" /> Fem-Index 2.0</DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', mb: 4 }}><Typography variant="h2" sx={{ ...DESIGN_TOKENS.textGradient, fontWeight: 'bold', fontSize: '3.5rem' }}>{details.score}</Typography><Typography variant="overline" color="text.secondary">COMPOSITE SCORE</Typography></Box>
                <Box sx={{ px: 1 }}>
                    {renderMetricRow("Enclosure (Material)", details.subScores.enclosure, PALETTE.primary.main, <CheckCircleOutlineIcon fontSize="small" color="primary" />)}
                    {renderMetricRow("Nocturnal (Nacht-Quote)", details.subScores.nocturnal, PALETTE.accents.purple, <NightlightRoundIcon fontSize="small" sx={{ color: PALETTE.accents.purple }} />)}
                    {renderMetricRow("Agilität (Reaktion)", details.subScores.compliance, PALETTE.accents.gold, <TimerIcon fontSize="small" sx={{ color: PALETTE.accents.gold }} />)}
                    {renderMetricRow("Disziplin (Lücken)", details.subScores.gap, PALETTE.accents.pink, <LinkOffIcon fontSize="small" sx={{ color: PALETTE.accents.pink }} />)}
                </Box>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}><Button onClick={onClose} fullWidth color="inherit">Schließen</Button></DialogActions>
        </Dialog>
    );
};

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { items, loading: itemsLoading } = useItems();
  const navigate = useNavigate();
  const { startBindingScan, isScanning: isNfcScanning } = useNFCGlobal();
  
  const { activeSessions, progress, loading: sessionsLoading, dailyTargetHours, registerRelease: hookRegisterRelease } = useSessionProgress(currentUser, items);
  
  const kpis = useKPIs(items, activeSessions); 
  const { femIndex, femIndexLoading, indexDetails } = useFemIndex(currentUser, items, activeSessions, kpis.coreMetrics.nocturnal); 

  const [now, setNow] = useState(Date.now());
  const [tzdActive, setTzdActive] = useState(false);
  const [tzdStartTime, setTzdStartTime] = useState(null); 
  const [isCheckingProtocol, setIsCheckingProtocol] = useState(true); 
  
  const [activeSuspension, setActiveSuspension] = useState(null);
  const [loadingSuspension, setLoadingSuspension] = useState(true);
  
  // UI States
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [instructionStatus, setInstructionStatus] = useState('idle');
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [sessionToStop, setSessionToStop] = useState(null);
  const [selectedFeelings, setSelectedFeelings] = useState([]);
  const [reflectionNote, setReflectionNote] = useState('');
  const [oathProgress, setOathProgress] = useState(0);
  const [isHoldingOath, setIsHoldingOath] = useState(false);
  const oathTimerRef = useRef(null);
  const [laundryOpen, setLaundryOpen] = useState(false);
  const [auditDue, setAuditDue] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [pendingAuditItems, setPendingAuditItems] = useState([]);
  const [currentAuditIndex, setCurrentAuditIndex] = useState(0);
  const [currentCondition, setCurrentCondition] = useState(5);
  const [currentLocationCorrect, setCurrentLocationCorrect] = useState(true);
  const [punishmentStatus, setPunishmentStatus] = useState({ active: false, deferred: false, reason: null, durationMinutes: 0 });
  const [punishmentItem, setPunishmentItem] = useState(null);
  const [punishmentScanOpen, setPunishmentScanOpen] = useState(false);
  const [punishmentScanMode, setPunishmentScanMode] = useState(null);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0); 
  const [maxInstructionItems, setMaxInstructionItems] = useState(1);
  const [currentPeriod, setCurrentPeriod] = useState(calculatePeriodId());
  const [isFreeDay, setIsFreeDay] = useState(false);
  const [freeDayReason, setFreeDayReason] = useState('');
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [releaseStep, setReleaseStep] = useState('confirm');
  const [releaseTimer, setReleaseTimer] = useState(600);
  const [releaseIntensity, setReleaseIntensity] = useState(3);
  const releaseTimerInterval = useRef(null);
  const [indexDialogOpen, setIndexDialogOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const [forcedReleaseOpen, setForcedReleaseOpen] = useState(false);
  const [forcedReleaseMethod, setForcedReleaseMethod] = useState(null);

  // NEU: Gamble & TimeBank State
  const [offerOpen, setOfferOpen] = useState(false);
  const [gambleStake, setGambleStake] = useState([]);
  const [hasGambledThisSession, setHasGambledThisSession] = useState(false);
  const [immunityActive, setImmunityActive] = useState(false);
  const [timeBankData, setTimeBankData] = useState({ nc: 0, lc: 0 });

  // Derived State
  const isNight = currentPeriod ? currentPeriod.includes('night') : false;
  const isInstructionActive = activeSessions.some(s => s.type === 'instruction');
  const isPunishmentRunning = activeSessions.some(s => s.type === 'punishment');
  const isDailyGoalMet = progress.isDailyGoalMet;
  
  // SYSTEM OVERRIDE DETECTION
  const hasVoluntarySession = activeSessions.some(s => s.type === 'voluntary' && !s.endTime);
  
  const budgetBalance = monthlyBudget - currentSpent;

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  // 1. Initial Load
  useEffect(() => {
    if (!currentUser) return;
    const initLoad = async () => {
        try {
            const pSnap = await getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`));
            if(pSnap.exists()) setMaxInstructionItems(pSnap.data().maxInstructionItems || 1);

            const statusData = await getActivePunishment(currentUser.uid);
            setPunishmentStatus(statusData || { active: false });
            
            setAuditDue(await isAuditDue(currentUser.uid));
            setMonthlyBudget(await loadMonthlyBudget(currentUser.uid));
            
            const bRef = doc(db, `users/${currentUser.uid}/settings/budget`);
            const bSnap = await getDoc(bRef);
            if(bSnap.exists()) setCurrentSpent(bSnap.data().currentSpent || 0);

            const susp = await checkActiveSuspension(currentUser.uid);
            setActiveSuspension(susp);

            const immune = await isImmunityActive(currentUser.uid);
            setImmunityActive(immune);

        } catch(e) { console.error(e); } finally { setLoadingSuspension(false); }
    };
    initLoad();

    // TIME BANK LISTENER
    const unsubscribeTB = onSnapshot(doc(db, `users/${currentUser.uid}/status/timeBank`), (docSnap) => {
        if (docSnap.exists()) {
            setTimeBankData(docSnap.data());
        } else {
            setTimeBankData({ nc: 0, lc: 0 });
        }
    });

    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { 
        clearInterval(timer);
        unsubscribeTB(); 
    };
  }, [currentUser]); 

  // 2. Punishment Item Load
  useEffect(() => {
      if (items.length > 0) setPunishmentItem(findPunishmentItem(items));
  }, [items]);

  // 3. TZD Check + GAMBLE TRIGGER
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
            } else { 
                if (tzdActive) {
                    setTzdActive(false); 
                    setTzdStartTime(null);
                }
                
                // --- GAMBLE CHECK ---
                if (!hasGambledThisSession && items.length > 0) {
                    const triggerGamble = await checkGambleTrigger(currentUser.uid, false, isInstructionActive);
                    if (triggerGamble) {
                        const stake = determineGambleStake(items);
                        if (stake.length > 0) {
                            setGambleStake(stake);
                            setOfferOpen(true);
                            setHasGambledThisSession(true);
                        }
                    } else {
                        setHasGambledThisSession(true); 
                    }
                }

                // REGULÄRER TRIGGER (während einer Session)
                if (isInstructionActive) { 
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
  }, [currentUser, items, activeSessions, itemsLoading, tzdActive, isInstructionActive, hasGambledThisSession]);

  // 4. Instruction / Period
  useEffect(() => {
    if (items.length > 0 && !sessionsLoading && currentPeriod) {
        const isIdle = instructionStatus === 'idle';
        const wrongPeriod = currentInstruction && currentInstruction.periodId !== currentPeriod;
        
        if ((isIdle || wrongPeriod) && instructionStatus !== 'loading') { 
            const check = async () => {
                setInstructionStatus('loading');
                try {
                    let instr = await getLastInstruction(currentUser.uid);
                    
                    if (instr && instr.periodId === currentPeriod) {
                        if (!instr.isAccepted && !instr.evasionPenaltyTriggered) {
                            const genDate = instr.generatedAt?.toDate ? instr.generatedAt.toDate() : new Date(instr.generatedAt);
                            const ageInMinutes = (new Date() - genDate) / 60000;
                            
                            if (ageInMinutes > 30) {
                                console.log("Flucht erkannt! Trigger 150% TZD.");
                                await triggerEvasionPenalty(currentUser.uid, instr.items);
                                
                                await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { 
                                    evasionPenaltyTriggered: true,
                                    isAccepted: true, 
                                    acceptedAt: new Date().toISOString()
                                });
                                
                                setTzdActive(true); 
                                setInstructionOpen(false); 
                                instr = null;
                            }
                        }
                        if (instr) setCurrentInstruction(instr);

                    } else if (!isFreeDay || currentPeriod.includes('night')) {
                        const newInstr = await generateAndSaveInstruction(currentUser.uid, items, activeSessions, currentPeriod);
                        setCurrentInstruction(newInstr);
                    } else {
                        setCurrentInstruction(null);
                    }
                } catch(e){ console.error("Instruction Load Error", e); } 
                finally { setInstructionStatus('ready'); }
            };
            check();
        }
    }
  }, [items.length, sessionsLoading, currentPeriod, currentInstruction, instructionStatus, isFreeDay]);

  // Forced Release Persistence Check
  useEffect(() => {
      if (isInstructionActive && currentInstruction) {
          const fr = currentInstruction.forcedRelease;
          if (fr && fr.required === true && fr.executed === false) {
              if (!forcedReleaseOpen) {
                  setForcedReleaseMethod(fr.method);
                  setForcedReleaseOpen(true);
              }
          }
      }
  }, [isInstructionActive, currentInstruction, forcedReleaseOpen]);

  useEffect(() => {
    const newPeriod = calculatePeriodId();
    if (newPeriod !== currentPeriod) setCurrentPeriod(newPeriod);
    const d = new Date(now);
    const day = d.getDay();
    const isWeekend = (day === 0 || day === 6);
    const isHoliday = checkIsHoliday(d);
    setIsFreeDay(isWeekend || isHoliday);
    setFreeDayReason(isHoliday ? 'Holiday' : (isWeekend ? 'Weekend' : ''));
  }, [now]);

  // HANDLERS (Gamble)
  const handleGambleAccept = async () => {
      const result = await rollTheDice(currentUser.uid, gambleStake);
      setOfferOpen(false);
      
      if (result.win) {
          showToast("GEWINN! 24h Immunität aktiviert.", "success");
          setImmunityActive(true);
      } else {
          // --- SYSTEM OVERRIDE PROTOCOL ---
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
                  showToast(`${voluntarySessions.length} Session(s) durch Protokoll überschrieben.`, "warning");
              } catch (e) { console.error(e); }
          }

          showToast("VERLOREN. Zeitloses Diktat aktiviert.", "error");
          setTzdActive(true);
          setTzdStartTime(new Date());
      }
  };

  const handleGambleDecline = () => {
      setOfferOpen(false);
      showToast("Sicher ist sicher...", "info");
  };

  // HANDLERS
  const handleStartRequest = async (itemsToStart) => { 
      if (tzdActive) { showToast("ZUGRIFF VERWEIGERT: Zeitloses Diktat aktiv.", "error"); return; }
      const targetItems = itemsToStart || currentInstruction?.items;
      if(targetItems && targetItems.length > 0) { 
          await startSessionService(currentUser.uid, {
            items: targetItems,
            type: 'instruction',
            periodId: currentInstruction.periodId,
            acceptedAt: currentInstruction.acceptedAt
          });
          
          setInstructionOpen(false); 
          showToast(`${targetItems.length} Sessions gestartet.`, "success");
          
          if (currentInstruction?.forcedRelease?.required && !currentInstruction.forcedRelease.executed) {
              setForcedReleaseMethod(currentInstruction.forcedRelease.method);
              setForcedReleaseOpen(true);
          }
      }
  };

  const startOathPress = () => { setIsHoldingOath(true); setOathProgress(0); oathTimerRef.current = setInterval(() => { setOathProgress(prev => { if (prev >= 100) { clearInterval(oathTimerRef.current); handleAcceptOath(); return 100; } return prev + 0.4; }); }, 20); };
  const cancelOathPress = () => { clearInterval(oathTimerRef.current); setIsHoldingOath(false); setOathProgress(0); };
  
  const handleAcceptOath = async () => { 
      const nowISO = new Date().toISOString(); 
      const batch = writeBatch(db); 
      batch.update(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { isAccepted: true, acceptedAt: nowISO }); 
      await batch.commit(); 
      setCurrentInstruction(prev => ({ ...prev, isAccepted: true, acceptedAt: nowISO })); 
      setIsHoldingOath(false); 
  };
  
  const handleDeclineOath = async () => { 
      await registerOathRefusal(currentUser.uid); 
      const newPunishment = await getActivePunishment(currentUser.uid);
      setPunishmentStatus(newPunishment || { active: false }); 
      setInstructionOpen(false); 
      setIsHoldingOath(false); 
  };

  const executeStartPunishment = async () => { 
      if(punishmentItem) { 
          await addDoc(collection(db,`users/${currentUser.uid}/sessions`),{ itemId:punishmentItem.id, itemIds:[punishmentItem.id], type:'punishment', startTime:serverTimestamp(), endTime:null }); 
          await updateDoc(doc(db,`users/${currentUser.uid}/status/punishment`),{active:true,deferred:false}); 
          const newStatus = await getActivePunishment(currentUser.uid);
          setPunishmentStatus(newStatus || { active: false }); 
          setPunishmentScanOpen(false); 
      } 
  };
  const handlePunishmentScanTrigger = () => { startBindingScan((scannedId) => { if (punishmentItem && (scannedId === punishmentItem.nfcTagId || scannedId === punishmentItem.customId || scannedId === punishmentItem.id)) { if (punishmentScanMode === 'start') executeStartPunishment(); else if (punishmentScanMode === 'stop') { setPunishmentScanOpen(false); setSelectedFeelings([]); setReflectionNote(''); setReflectionOpen(true); } } else { showToast("Falscher Tag!", "error"); } }); };

  const handleRequestStopSession = (session) => { 
      if (tzdActive) { showToast("STOPPEN VERWEIGERT.", "error"); return; }
      if (session.type === 'punishment') { 
          const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 60000); 
          if (elapsed < (punishmentStatus.durationMinutes || 30)) return; 
      } 
      setSessionToStop(session); setSelectedFeelings([]); setReflectionNote(''); setReflectionOpen(true); 
  };
  
  const handleConfirmStopSession = async () => { 
      if (!sessionToStop) return; 
      try { 
          await stopSessionService(currentUser.uid, sessionToStop.id, { feelings: selectedFeelings, note: reflectionNote }); 
          
          if(sessionToStop.type === 'punishment') { 
              await clearPunishment(currentUser.uid); 
              setPunishmentStatus({ active: false, deferred: false, reason: null, durationMinutes: 0 });
          } 
      } catch(e){ showToast("Fehler", "error"); } finally { setReflectionOpen(false); setSessionToStop(null); } 
  };

  const handleStartAudit = async () => { const auditItems = await initializeAudit(currentUser.uid, items); setPendingAuditItems(auditItems); setCurrentAuditIndex(0); setAuditOpen(true); };
  const handleConfirmAuditItem = async () => { await confirmAuditItem(currentUser.uid, pendingAuditItems[currentAuditIndex].id, currentCondition, currentLocationCorrect); showToast(`${pendingAuditItems[currentAuditIndex].name} geprüft`, "success"); if(currentAuditIndex<pendingAuditItems.length-1) setCurrentAuditIndex(prev=>prev+1); else { setAuditOpen(false); setAuditDue(false); showToast("Audit abgeschlossen", "success"); } };

  const handleOpenRelease = () => { setReleaseStep('confirm'); setReleaseTimer(600); setReleaseIntensity(3); setReleaseDialogOpen(true); };
  const handleStartReleaseTimer = () => { setReleaseStep('timer'); if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); releaseTimerInterval.current = setInterval(() => { setReleaseTimer(prev => { if(prev <= 1) { clearInterval(releaseTimerInterval.current); setReleaseStep('decision'); return 0; } return prev - 1; }); }, 1000); };
  const handleSkipTimer = () => { if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); setReleaseStep('decision'); };
  const handleReleaseDecision = async (outcome) => { try { await hookRegisterRelease(outcome, releaseIntensity); if (outcome === 'maintained') showToast("Disziplin bewiesen.", "success"); else showToast("Sessions beendet.", "warning"); } catch (e) { showToast("Fehler beim Release", "error"); } finally { setReleaseDialogOpen(false); if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); } };

  const handleConfirmForcedRelease = async (outcome) => {
      const safeOutcome = outcome || 'clean';
      try {
          await apiRegisterRelease(currentUser.uid, 'maintained', 5, safeOutcome);
          await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { "forcedRelease.executed": true });
          setCurrentInstruction(prev => ({ ...prev, forcedRelease: { ...prev.forcedRelease, executed: true } }));
          setForcedReleaseOpen(false);
          if (safeOutcome === 'clean') showToast("Brav. Sauber und gehorsam.", "success");
          else showToast("Schmutzig... aber gehorsam. Status gespeichert.", "warning");
      } catch (e) {
          console.error("Error confirming forced release:", e);
          showToast("Fehler beim Speichern.", "error");
      }
  };

  const handleRefuseForcedRelease = async () => {
      try {
          await registerPunishment(currentUser.uid, "Forced Release Protocol verweigert", 60);
          const newStatus = await getActivePunishment(currentUser.uid);
          setPunishmentStatus(newStatus || { active: false });
          
          await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), { "forcedRelease.executed": true });
          setCurrentInstruction(prev => ({ ...prev, forcedRelease: { ...prev.forcedRelease, executed: true } }));
          setForcedReleaseOpen(false);
          showToast("Strafe registriert. Schlaf jetzt... wenn du kannst.", "warning");
      } catch (e) {
          console.error("Error refusing forced release:", e);
      }
  };

  if (loadingSuspension) return <Box sx={{ p: 4, textAlign: 'center' }}>System Check...</Box>;

  // --- GATEKEEPER BLOCK ---
  if (isCheckingProtocol) {
      return (
          <Box sx={{ 
              height: '100vh', width: '100vw', bgcolor: '#000', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, position: 'fixed', top: 0, left: 0
          }}>
              <LockIcon sx={{ fontSize: 60, color: PALETTE.accents.red, mb: 2 }} />
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 4, animation: 'pulse 1.5s infinite' }}>
                  SYSTEM INTERLOCK...
              </Typography>
          </Box>
      );
  }

  if (activeSuspension) {
      return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="sm" sx={{ pt: 10, textAlign: 'center' }}>
                <Box sx={{ mb: 4, color: PALETTE.accents.gold }}><Icons.Shield sx={{ fontSize: 80 }} /></Box>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', letterSpacing: 2 }}>PROTOKOLL AUSGESETZT</Typography>
                <Paper sx={{ p: 4, ...DESIGN_TOKENS.glassCard, border: `1px solid ${PALETTE.accents.gold}` }}>
                    <Chip label={activeSuspension.type.toUpperCase()} sx={{ bgcolor: PALETTE.accents.gold, color: '#000', fontWeight: 'bold', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>{activeSuspension.reason}</Typography>
                    <Typography variant="body2" color="text.secondary">Geplant bis: {activeSuspension.endDate.toLocaleDateString()}</Typography>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="caption" sx={{ display: 'block', mb: 2 }}>Status: Autorisierte Abwesenheit. Keine Aufgaben.</Typography>
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block' }}>Um den Dienst wieder aufzunehmen, gehe zu Einstellungen.</Typography>
            </Container>
        </Box>
      );
  }

  const laundryCount = items.filter(i => i.status === 'washing').length;

  return (
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      <TzdOverlay active={tzdActive} startTime={tzdStartTime} />
      
      <ForcedReleaseOverlay 
          open={forcedReleaseOpen}
          method={forcedReleaseMethod}
          onConfirm={handleConfirmForcedRelease}
          onRefuse={handleRefuseForcedRelease}
      />
      
      {/* GAMBLE DIALOG */}
      <OfferDialog 
          open={offerOpen} 
          stakeItems={gambleStake} 
          onAccept={handleGambleAccept} 
          onDecline={handleGambleDecline}
          hasActiveSession={hasVoluntarySession} // NEU: Prop für den Warnhinweis
      />

      <Container maxWidth="md" sx={{ pt: 2, pb: 4 }}>
        <motion.div variants={MOTION.page} initial="initial" animate="animate" exit="exit">
            
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>Dashboard</Typography>
                {immunityActive && (
                    <Chip 
                        icon={<ShieldIcon sx={{color:'#000 !important'}}/>} 
                        label="IMMUN" 
                        sx={{ bgcolor: PALETTE.accents.green, color: '#000', fontWeight: 'bold' }} 
                    />
                )}
            </Box>

            <ProgressBar 
                currentMinutes={progress.currentContinuousMinutes} 
                targetHours={dailyTargetHours} 
                isGoalMetToday={progress.isDailyGoalMet} 
                progressData={progress}
            />

            <FemIndexBar femIndex={femIndex || 0} loading={femIndexLoading} />

            <ActionButtons 
                punishmentStatus={punishmentStatus} 
                punishmentRunning={isPunishmentRunning}
                auditDue={auditDue}
                isFreeDay={isFreeDay}
                freeDayReason={freeDayReason}
                currentInstruction={currentInstruction}
                currentPeriod={currentPeriod}
                isHoldingOath={isHoldingOath}
                isInstructionActive={isInstructionActive}
                isDailyGoalMet={isDailyGoalMet}
                onOpenInstruction={() => setInstructionOpen(true)}
                onStartPunishment={() => {
                    if (punishmentItem?.nfcTagId) { setPunishmentScanMode('start'); setPunishmentScanOpen(true); } 
                    else executeStartPunishment(); 
                }}
                onStartAudit={handleStartAudit}
            />

            <ActiveSessionsList 
                activeSessions={activeSessions} 
                items={items}
                punishmentStatus={punishmentStatus}
                onNavigateItem={(id) => navigate(`/item/${id}`)}
                onStopSession={handleRequestStopSession} 
                onOpenRelease={handleOpenRelease}
            />

            <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" color="text.secondary">METRIKEN & VERWALTUNG</Typography>
            </Divider>

            {/* NEU: TimeBank an InfoTiles übergeben */}
            <InfoTiles kpis={kpis} timeBank={timeBankData} />

            <Button
              variant="contained" fullWidth size="large" onClick={() => setLaundryOpen(true)}
              sx={{ 
                  mb: 2, mt: 3, py: 2, bgcolor: 'rgba(255,255,255,0.05)', color: 'text.primary', boxShadow: 'none', justifyContent: 'space-between', px: 3,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', boxShadow: 'none' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><LocalLaundryServiceIcon /><Typography variant="button" sx={{ fontWeight: 'bold' }}>Wäschekorb</Typography></Box>
              <Chip label={`${laundryCount} Stk.`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'text.primary', fontWeight: 'bold', borderRadius: '4px' }} />
            </Button>

            <Button
              variant="contained" fullWidth size="large" onClick={() => navigate('/budget')}
              sx={{ 
                  mb: 4, py: 2, bgcolor: 'rgba(255,255,255,0.05)', color: 'text.primary', boxShadow: 'none', justifyContent: 'space-between', px: 3,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', boxShadow: 'none' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><AccountBalanceWalletIcon /><Typography variant="button" sx={{ fontWeight: 'bold' }}>Budget & Finanzen</Typography></Box>
              <Chip 
                  label={`${budgetBalance.toFixed(2)}€`} 
                  size="small" 
                  sx={{ 
                      bgcolor: budgetBalance < 0 ? `${PALETTE.accents.red}22` : 'rgba(255,255,255,0.1)', 
                      color: budgetBalance < 0 ? PALETTE.accents.red : PALETTE.accents.green,
                      fontWeight: 'bold', 
                      borderRadius: '4px',
                      border: `1px solid ${budgetBalance < 0 ? PALETTE.accents.red : 'transparent'}`
                  }} 
              />
            </Button>

        </motion.div>
      </Container>

      <InstructionDialog open={instructionOpen} onClose={() => setInstructionOpen(false)} instruction={currentInstruction} items={items} isHoldingOath={isHoldingOath} oathProgress={oathProgress} onStartOath={startOathPress} onCancelOath={cancelOathPress} onDeclineOath={handleDeclineOath} onStartRequest={handleStartRequest} onNavigateItem={(id) => { setInstructionOpen(false); navigate(`/item/${id}`); }} isFreeDay={isFreeDay} freeDayReason={freeDayReason} loadingStatus={instructionStatus === 'idle' ? 'loading' : instructionStatus} isNight={isNight} showToast={showToast} />
      <PunishmentDialog open={punishmentScanOpen} onClose={() => setPunishmentScanOpen(false)} mode={punishmentScanMode} punishmentItem={punishmentItem} isScanning={isNfcScanning} onScan={handlePunishmentScanTrigger} />
      <LaundryDialog open={laundryOpen} onClose={() => setLaundryOpen(false)} washingItems={items.filter(i => i.status === 'washing')} onWashItem={async (id) => { try { await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), { status: 'active', cleanDate: serverTimestamp(), historyLog: arrayUnion({ type: 'wash', date: new Date().toISOString() }) }); if(kpis?.basics?.washing <= 1) setLaundryOpen(false); } catch(e){}} } onWashAll={async () => { try { const timestamp = new Date().toISOString(); const promises = items.filter(i=>i.status==='washing').map(i => updateDoc(doc(db, `users/${currentUser.uid}/items`, i.id), { status: 'active', cleanDate: serverTimestamp(), historyLog: arrayUnion({ type: 'wash', date: timestamp }) })); await Promise.all(promises); setLaundryOpen(false); } catch (e) {} }} />
      <ReleaseProtocolDialog open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)} step={releaseStep} timer={releaseTimer} intensity={releaseIntensity} setIntensity={setReleaseIntensity} onStartTimer={handleStartReleaseTimer} onSkipTimer={handleSkipTimer} onDecision={handleReleaseDecision} />
      
      <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} fullWidth PaperProps={DESIGN_TOKENS.dialog.paper}>
          <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Audit: {pendingAuditItems[currentAuditIndex]?.name}</DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <TextField type="number" label="Zustand (1-5)" value={currentCondition} onChange={e => setCurrentCondition(parseInt(e.target.value))} fullWidth sx={{mt:2}} />
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button onClick={() => setAuditOpen(false)} color="inherit">Abbrechen</Button>
              <Button onClick={handleConfirmAuditItem} variant="contained" color="warning">Bestätigen</Button>
          </DialogActions>
      </Dialog>

      <Dialog open={reflectionOpen} onClose={() => setReflectionOpen(false)} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
          <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Reflektion</DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <FormGroup>
                  {REFLECTION_TAGS.map(t => (
                      <FormControlLabel key={t} control={<Checkbox onChange={() => setSelectedFeelings(prev => prev.includes(t) ? prev.filter(f => f !== t) : [...prev, t])}/>} label={t}/>
                  ))}
              </FormGroup>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button onClick={() => setReflectionOpen(false)} color="inherit">Abbrechen</Button>
              <Button onClick={handleConfirmStopSession} variant="contained">Bestätigen</Button>
          </DialogActions>
      </Dialog>

      <IndexDetailDialog open={indexDialogOpen} onClose={() => setIndexDialogOpen(false)} details={indexDetails} />
      
      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}>
          <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}