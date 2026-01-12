import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, getDocs, doc, updateDoc, serverTimestamp, 
  addDoc, arrayUnion, writeBatch, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';

// FRAMER MOTION
import { motion } from 'framer-motion';

// HOOKS
import useSessionProgress from '../hooks/dashboard/useSessionProgress';
import { useKPIs } from '../hooks/useKPIs'; 

// SERVICES
import { isAuditDue, initializeAudit, confirmAuditItem } from '../services/AuditService';
import { getPunishmentStatus, clearPunishment, findPunishmentItem, registerOathRefusal } from '../services/PunishmentService';
import { loadMonthlyBudget, calculatePurchasePriority } from '../services/BudgetService';
import { generateAndSaveInstruction } from '../services/InstructionService';
import { registerRelease } from '../services/ReleaseService';
import { checkForTZDTrigger, getTZDStatus } from '../services/TZDService'; // TZD INTEGRATION

// COMPONENTS
import TzdOverlay from '../components/dashboard/TzdOverlay'; 
import ProgressBar from '../components/dashboard/ProgressBar';
import FemIndexBar from '../components/dashboard/FemIndexBar';
import ActionButtons from '../components/dashboard/ActionButtons';
import ActiveSessionsList from '../components/dashboard/ActiveSessionsList';
import InfoTiles from '../components/dashboard/InfoTiles';
import InstructionDialog from '../components/dialogs/InstructionDialog';
import ReleaseProtocolDialog from '../components/dialogs/ReleaseProtocolDialog';
import PunishmentDialog from '../components/dialogs/PunishmentDialog';
import LaundryDialog from '../components/dialogs/LaundryDialog';

// UI & THEME
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { 
    Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, 
    Snackbar, Alert, FormGroup, FormControlLabel, Checkbox, TextField, 
    Button, CircularProgress, Container, Paper, Chip, LinearProgress 
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import TimerIcon from '@mui/icons-material/Timer';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// --- MOTION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1 
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 }
  }
};

// --- HILFSFUNKTIONEN ---
const getLocalISODate = (date) => { 
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const checkIsHoliday = (date) => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    if (m === 12 && (d === 24 || d === 25 || d === 26)) return true;
    if (m === 12 && d === 31) return true;
    if (m === 1 && d === 1) return true;
    return false;
};

const REFLECTION_TAGS = ["Sicher / Geborgen", "Erregt", "Gedemütigt", "Exponiert / Öffentlich", "Feminin", "Besitztum (Owned)", "Unwürdig", "Stolz"];

// --- SUB-KOMPONENTE: INDEX DETAIL ---
const IndexDetailDialog = ({ open, onClose, details }) => {
    if (!details) return null;
    const renderMetricRow = (label, value, weight, icon, color) => (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {icon}
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: color }}>
                    {Math.round(value)}%
                </Typography>
            </Box>
            <LinearProgress variant="determinate" value={value} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
        </Box>
    );
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: '#121212', border: '1px solid rgba(255,255,255,0.1)' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><AnalyticsIcon color="primary" /><Typography variant="h6">Fem-Index 2.0</Typography></DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                <Box sx={{ textAlign: 'center', mb: 4 }}><Typography variant="h2" sx={{ ...DESIGN_TOKENS.textGradient, fontWeight: 'bold', fontSize: '3.5rem' }}>{details.score}</Typography><Typography variant="overline" color="text.secondary">COMPOSITE SCORE</Typography></Box>
                <Box sx={{ px: 1 }}>
                    {renderMetricRow("Enclosure (Material)", details.subScores.enclosure, 35, <CheckCircleOutlineIcon fontSize="small" color="primary" />, PALETTE.primary.main)}
                    {renderMetricRow("Nocturnal (Nacht-Quote)", details.subScores.nocturnal, 25, <NightlightRoundIcon fontSize="small" sx={{ color: PALETTE.accents.purple }} />, PALETTE.accents.purple)}
                    {renderMetricRow("Agilität (Reaktion)", details.subScores.compliance, 20, <TimerIcon fontSize="small" sx={{ color: PALETTE.accents.gold }} />, PALETTE.accents.gold)}
                    {renderMetricRow("Disziplin (Lücken)", details.subScores.gap, 20, <LinkOffIcon fontSize="small" sx={{ color: PALETTE.accents.pink }} />, PALETTE.accents.pink)}
                </Box>
            </DialogContent>
            <DialogActions><Button onClick={onClose} fullWidth color="inherit">Schließen</Button></DialogActions>
        </Dialog>
    );
};

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { items, loading: itemsLoading } = useItems();
  const navigate = useNavigate();
  const { startBindingScan, isScanning: isNfcScanning } = useNFCGlobal();
  
  // --- HOOKS ---
  const { activeSessions, progress, loading: sessionsLoading, dailyTargetHours, startInstructionSession, stopSession, registerRelease: hookRegisterRelease, loadActiveSessions } = useSessionProgress(currentUser, items);
  
  // KPI Hook liefert jetzt das Datenobjekt direkt
  const kpis = useKPIs(items, activeSessions);

  // Local UI State
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Global initial load
  const [now, setNow] = useState(Date.now());
  
  // TZD State
  const [tzdActive, setTzdActive] = useState(false);

  // Dialog & Flow States
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
  const lastCheckedPeriod = useRef(null);
  const hasInitialLoadHappened = useRef(false);
  
  const [laundryOpen, setLaundryOpen] = useState(false);
  
  // Audit States
  const [auditDue, setAuditDue] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [pendingAuditItems, setPendingAuditItems] = useState([]);
  const [currentAuditIndex, setCurrentAuditIndex] = useState(0);
  const [currentCondition, setCurrentCondition] = useState(5);
  const [currentLocationCorrect, setCurrentLocationCorrect] = useState(true);
  
  // Punishment States
  const [punishmentStatus, setPunishmentStatus] = useState({ active: false, deferred: false, reason: null, durationMinutes: 0 });
  const [punishmentItem, setPunishmentItem] = useState(null);
  const [punishmentScanOpen, setPunishmentScanOpen] = useState(false);
  const [punishmentScanMode, setPunishmentScanMode] = useState(null);
  
  // Budget & Planning
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0); 
  const [purchasePriority, setPurchasePriority] = useState([]);
  
  const [maxInstructionItems, setMaxInstructionItems] = useState(1);
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [isFreeDay, setIsFreeDay] = useState(false);
  const [freeDayReason, setFreeDayReason] = useState('');

  // Release Protocol
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [releaseStep, setReleaseStep] = useState('confirm');
  const [releaseTimer, setReleaseTimer] = useState(600);
  const [releaseIntensity, setReleaseIntensity] = useState(3);
  const releaseTimerInterval = useRef(null);
  
  // Detail Dialogs
  const [indexDialogOpen, setIndexDialogOpen] = useState(false);
  
  // TOAST SYSTEM
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  // --- SETTINGS LOAD ---
  const loadSettings = async () => { 
      const pSnap = await getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`));
      let prefs = {};
      if (pSnap.exists()) { 
          prefs = pSnap.data();
          setMaxInstructionItems(prefs.maxInstructionItems || 1); 
      }
      return prefs;
  };

  const loadWishlist = async () => {
      const s = await getDocs(query(collection(db, `users/${currentUser.uid}/wishlist`)));
      setWishlistCount(s.docs.length);
      return s.docs.map(d => ({id:d.id, ...d.data()}));
  };

  const loadBudgetInfo = async () => {
      const bRef = doc(db, `users/${currentUser.uid}/settings/budget`);
      const bSnap = await getDoc(bRef);
      if(bSnap.exists()) { setMonthlyBudget(bSnap.data().monthlyLimit || 0); setCurrentSpent(bSnap.data().currentSpent || 0); }
  };

  // --- TZD LOGIC (THE TRIGGER) ---
  useEffect(() => {
    let interval;
    const checkTZD = async () => {
        if (!currentUser || itemsLoading) return;

        // 1. Prüfen: Ist es bereits aktiv?
        const status = await getTZDStatus(currentUser.uid);
        if (status.isActive) {
            if (!tzdActive) setTzdActive(true);
            return; 
        } else {
            if (tzdActive) setTzdActive(false);
        }

        // 2. Trigger-Versuch
        const triggered = await checkForTZDTrigger(currentUser.uid, activeSessions, items);
        if (triggered) {
            setTzdActive(true);
        }
    };

    if (currentUser && !itemsLoading) {
        checkTZD(); 
        interval = setInterval(checkTZD, 300000); // Check alle 5 Minuten
    }
    
    return () => clearInterval(interval);
  }, [currentUser, items, activeSessions, itemsLoading, tzdActive]);


  useEffect(() => {
      const d = new Date(now);
      const day = d.getDay(); 
      const isWeekend = (day === 0 || day === 6);
      const isHoliday = checkIsHoliday(d);
      setIsFreeDay(isWeekend || isHoliday);
      if (isHoliday) setFreeDayReason('Holiday'); else if (isWeekend) setFreeDayReason('Weekend'); else setFreeDayReason('');
  }, [now]);

  const handleOpenRelease = () => { setReleaseStep('confirm'); setReleaseTimer(600); setReleaseIntensity(3); setReleaseDialogOpen(true); };
  
  const handleStartReleaseTimer = () => {
      setReleaseStep('timer');
      if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current);
      releaseTimerInterval.current = setInterval(() => {
          setReleaseTimer(prev => { if(prev <= 1) { clearInterval(releaseTimerInterval.current); setReleaseStep('decision'); return 0; } return prev - 1; });
      }, 1000);
  };
  
  const handleSkipTimer = () => { if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); setReleaseStep('decision'); };
  
  const handleReleaseDecision = async (outcome) => {
      try {
          // Wir nutzen den Hook für das Release-Registering, damit Stats korrekt aktualisiert werden
          await hookRegisterRelease(outcome, releaseIntensity);
          if (outcome === 'maintained') showToast("Disziplin bewiesen.", "success");
          else showToast("Sessions beendet.", "warning");
      } catch (e) { 
          showToast("Fehler beim Release", "error"); 
      } finally { 
          setReleaseDialogOpen(false); 
          if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); 
      }
  };

  const getPeriodId = useCallback(() => {
    const d = new Date(); const mins = d.getHours() * 60 + d.getMinutes(); 
    let period = (mins >= 450 && mins < 1380) ? 'day' : 'night';
    let dateStr = getLocalISODate(d);
    if (mins < 450) { const y = new Date(d); y.setDate(y.getDate() - 1); dateStr = getLocalISODate(y); }
    return `${dateStr}-${period}`;
  }, []);

  const checkAndGenerateInstruction = async (periodId) => {
      if (!currentUser) return;
      const d = new Date();
      const isWeekendNow = (d.getDay() === 0 || d.getDay() === 6);
      const isHolidayNow = checkIsHoliday(d);
      const effectivelyFree = (isWeekendNow || isHolidayNow) && !periodId.includes('night');
      const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
      
      setInstructionStatus('loading'); 

      if (effectivelyFree) {
          try {
              const instrSnap = await getDoc(instrRef);
              if (instrSnap.exists() && instrSnap.data().periodId === periodId && instrSnap.data().isAccepted) setCurrentInstruction(instrSnap.data());
              else setCurrentInstruction(null); 
          } catch(e) {}
          setInstructionStatus('ready');
          return; 
      }
      
      try {
          const instrSnap = await getDoc(instrRef);
          if (instrSnap.exists() && instrSnap.data().periodId === periodId) setCurrentInstruction(instrSnap.data());
          else {
              const newInstruction = await generateAndSaveInstruction(currentUser.uid, items, activeSessions, periodId);
              setCurrentInstruction(newInstruction || null);
          }
      } catch (e) { setCurrentInstruction(null); } finally { setInstructionStatus('ready'); }
  };

  // 1. Period Detection
  useEffect(() => {
    if (items.length > 0 && !sessionsLoading) {
        const newPeriod = getPeriodId();
        if (newPeriod !== lastCheckedPeriod.current) {
            lastCheckedPeriod.current = newPeriod;
            setCurrentPeriod(newPeriod);
        }
    }
  }, [items.length, sessionsLoading, now, getPeriodId]);

  // 2. Data Fetching
  useEffect(() => {
    if (items.length > 0 && !sessionsLoading && currentPeriod) {
        const isIdle = instructionStatus === 'idle';
        const wrongPeriod = currentInstruction && currentInstruction.periodId !== currentPeriod;

        if ((isIdle || wrongPeriod) && instructionStatus !== 'loading') {
            checkAndGenerateInstruction(currentPeriod);
        }
    }
  }, [items.length, sessionsLoading, currentPeriod, currentInstruction, instructionStatus]);

  const handleStartRequest = async (itemsToStart) => { 
      // TZD BLOCKADE
      if (tzdActive) {
          showToast("ZUGRIFF VERWEIGERT: Das Zeitlose Diktat ist aktiv.", "error");
          return;
      }

      const targetItems = itemsToStart || currentInstruction?.items;
      if(targetItems && targetItems.length > 0) { 
          // Payload bauen für startInstructionSession
          const payload = { 
              ...currentInstruction, 
              items: targetItems 
          };
          await startInstructionSession(payload); 
          setInstructionOpen(false); 
          showToast(`${targetItems.length} Sessions gestartet.`, "success");
      }
  };
  
  const startOathPress = () => { 
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
  };
  
  const cancelOathPress = () => { 
      clearInterval(oathTimerRef.current); 
      setIsHoldingOath(false); 
      setOathProgress(0); 
  };
  
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
      setPunishmentStatus(await getPunishmentStatus(currentUser.uid)); 
      setInstructionOpen(false); 
      setIsHoldingOath(false); 
  };

  const executeStartPunishment = async () => { 
      if(punishmentItem) { 
          await addDoc(collection(db,`users/${currentUser.uid}/sessions`),{ itemId:punishmentItem.id, itemIds:[punishmentItem.id], type:'punishment', startTime:serverTimestamp(), endTime:null }); 
          await updateDoc(doc(db,`users/${currentUser.uid}/status/punishment`),{active:true,deferred:false}); 
          setPunishmentStatus(await getPunishmentStatus(currentUser.uid)); 
          loadActiveSessions(); 
          setPunishmentScanOpen(false); 
      } 
  };
  
  const handlePunishmentScanTrigger = () => { 
      startBindingScan((scannedId) => { 
          if (punishmentItem && (scannedId === punishmentItem.nfcTagId || scannedId === punishmentItem.customId || scannedId === punishmentItem.id)) { 
              if (punishmentScanMode === 'start') executeStartPunishment(); 
              else if (punishmentScanMode === 'stop') { 
                  setPunishmentScanOpen(false); 
                  setSelectedFeelings([]); 
                  setReflectionNote(''); 
                  setReflectionOpen(true); 
              } 
          } else { 
              showToast("Falscher Tag!", "error"); 
          } 
      }); 
  };

  const handleRequestStopSession = (session) => { 
      // TZD BLOCKADE
      if (tzdActive) {
          showToast("STOPPEN NICHT MÖGLICH. Objekt ist durch Protokoll gebunden.", "error");
          return;
      }

      if (session.type === 'punishment') { 
          const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 60000); 
          if (elapsed < (punishmentStatus.durationMinutes || 30)) return; 
          if (punishmentItem?.nfcTagId) { 
              setSessionToStop(session); 
              setPunishmentScanMode('stop'); 
              setPunishmentScanOpen(true); 
              return; 
          } 
      } 
      setSessionToStop(session); 
      setSelectedFeelings([]); 
      setReflectionNote(''); 
      setReflectionOpen(true); 
  };
  
  const handleConfirmStopSession = async () => { 
      if (!sessionToStop) return; 
      setLoading(true); 
      try { 
          await stopSession(sessionToStop, { feelings: selectedFeelings, note: reflectionNote }); 
          if(sessionToStop.type === 'punishment') { 
              await clearPunishment(currentUser.uid); 
              setPunishmentStatus(await getPunishmentStatus(currentUser.uid)); 
          } 
      } catch(e){ 
          showToast("Fehler", "error"); 
      } finally { 
          setReflectionOpen(false); 
          setSessionToStop(null); 
          setLoading(false); 
      } 
  };

  const handleStartAudit = async () => { 
      const auditItems = await initializeAudit(currentUser.uid, items); 
      setPendingAuditItems(auditItems); 
      setCurrentAuditIndex(0); 
      setAuditOpen(true); 
  };
  
  const handleConfirmAuditItem = async () => { 
      await confirmAuditItem(currentUser.uid, pendingAuditItems[currentAuditIndex].id, currentCondition, currentLocationCorrect);
      showToast(`${pendingAuditItems[currentAuditIndex].name} geprüft`, "success"); 
      if(currentAuditIndex<pendingAuditItems.length-1) setCurrentAuditIndex(prev=>prev+1); 
      else { 
          setAuditOpen(false); 
          setAuditDue(false); 
          showToast("Audit abgeschlossen", "success"); 
      } 
  };

  // INITIAL LOAD
  useEffect(() => {
    if (!currentUser || hasInitialLoadHappened.current || itemsLoading) return;
    const initLoad = async () => {
        setLoading(true);
        try {
            await loadSettings(); 
            const statusData = await getPunishmentStatus(currentUser.uid);
            const [, wishlistData] = await Promise.all([ Promise.resolve(), loadWishlist() ]);
            
            setPunishmentItem(findPunishmentItem(items)); 
            setPunishmentStatus(statusData);
            setAuditDue(await isAuditDue(currentUser.uid));
            setMonthlyBudget(await loadMonthlyBudget(currentUser.uid));
            await loadBudgetInfo(); 
            setPurchasePriority(await calculatePurchasePriority(currentUser.uid, items, wishlistData));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    initLoad(); hasInitialLoadHappened.current = true;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [currentUser, items, itemsLoading]);

  const isGlobalLoading = loading || itemsLoading || sessionsLoading;
  
  if (isGlobalLoading && !activeSessions.length) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress /></Box>;
  
  const isNight = currentPeriod && currentPeriod.includes('night');

  return (
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      <Container maxWidth="md">
        
        {/* TZD OVERLAY - Always on Top */}
        <TzdOverlay active={tzdActive} onRefresh={loadActiveSessions} />

        {/* FRAMER MOTION CONTAINER */}
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* 1. Header */}
            <motion.div variants={itemVariants}>
                <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Dashboard</Typography>
            </motion.div>
            
            {/* 2. Progress Ring */}
            <motion.div variants={itemVariants}>
                <ProgressBar 
                    currentMinutes={progress.currentContinuousMinutes} 
                    targetHours={dailyTargetHours} 
                    isGoalMetToday={progress.isDailyGoalMet} 
                    progressData={progress} 
                />
            </motion.div>
            
            {/* 3. Fem Index */}
            <motion.div variants={itemVariants}>
                <Box onClick={() => setIndexDialogOpen(true)} sx={{ cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)' } }}>
                    <FemIndexBar femIndex={kpis?.femIndex?.score || 0} loading={itemsLoading} />
                </Box>
            </motion.div>

            {/* 4. Action Buttons */}
            <motion.div variants={itemVariants}>
                <ActionButtons 
                    punishmentStatus={punishmentStatus} auditDue={auditDue} isFreeDay={isFreeDay}
                    freeDayReason={freeDayReason} currentInstruction={currentInstruction} currentPeriod={currentPeriod}
                    isHoldingOath={isHoldingOath} onStartPunishment={() => { if (punishmentItem?.nfcTagId) { setPunishmentScanMode('start'); setPunishmentScanOpen(true); } else executeStartPunishment(); }}
                    onStartAudit={handleStartAudit} onOpenInstruction={() => setInstructionOpen(true)}
                />
            </motion.div>
            
            {/* 5. Active Sessions List */}
            <motion.div variants={itemVariants}>
                <ActiveSessionsList 
                    activeSessions={activeSessions} items={items} punishmentStatus={punishmentStatus}
                    washingItemsCount={kpis?.basics?.washing || 0} 
                    onNavigateItem={(id) => navigate(`/item/${id}`)}
                    onOpenRelease={handleOpenRelease} onStopSession={handleRequestStopSession} onOpenLaundry={() => setLaundryOpen(true)}
                    isLocked={tzdActive} // Visual lock for list
                />
            </motion.div>
            
            {/* 6. Info Tiles */}
            <motion.div variants={itemVariants}>
                <InfoTiles 
                    kpis={kpis}
                    wishlistCount={wishlistCount} 
                    highestPriorityItem={purchasePriority?.[0]}
                    onOpenBudget={() => navigate('/budget')} 
                    onNavigateWishlist={() => navigate('/wishlist')}
                />
            </motion.div>

            {/* 7. Budget Quick View */}
            <motion.div variants={itemVariants}>
                <Paper 
                    sx={{ 
                        p: 2, mt: 2, ...DESIGN_TOKENS.glassCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', transition: 'background 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
                    }}
                    onClick={() => navigate('/budget')}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: '50%', display:'flex' }}>
                            <AccountBalanceWalletIcon color="action" fontSize="small" />
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Budget</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {Math.max(0, monthlyBudget - currentSpent).toFixed(2)} € verfügbar
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {kpis?.health?.wornOutCount > 0 && (
                            <Chip label={`${kpis.health.wornOutCount} Ersetzen`} size="small" color="warning" variant="outlined" icon={<WarningAmberIcon />} sx={{ height: 24, '.MuiChip-label': { px: 1 } }} />
                        )}
                        <ArrowForwardIosIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    </Box>
                </Paper>
            </motion.div>
        </motion.div>

        {/* --- DIALOGS & OVERLAYS --- */}

        <ReleaseProtocolDialog 
            open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)}
            step={releaseStep} timer={releaseTimer} intensity={releaseIntensity} setIntensity={setReleaseIntensity}
            onStartTimer={handleStartReleaseTimer} onSkipTimer={handleSkipTimer} onDecision={handleReleaseDecision}
        />
        
        <LaundryDialog 
            open={laundryOpen} onClose={() => setLaundryOpen(false)} washingItems={items.filter(i => i.status === 'washing')} 
            onWashItem={async (id) => { try { await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), { status: 'active', cleanDate: serverTimestamp(), historyLog: arrayUnion({ type: 'wash', date: new Date().toISOString() }) }); if(kpis?.basics?.washing <= 1) setLaundryOpen(false); } catch(e){}} }
            onWashAll={async () => { try { const timestamp = new Date().toISOString(); const promises = items.filter(i=>i.status==='washing').map(i => updateDoc(doc(db, `users/${currentUser.uid}/items`, i.id), { status: 'active', cleanDate: serverTimestamp(), historyLog: arrayUnion({ type: 'wash', date: timestamp }) })); await Promise.all(promises); setLaundryOpen(false); } catch (e) {} }}
        />
        
        <InstructionDialog 
            open={instructionOpen} onClose={() => setInstructionOpen(false)} instruction={currentInstruction} items={items}
            isHoldingOath={isHoldingOath} oathProgress={oathProgress} onStartOath={startOathPress} onCancelOath={cancelOathPress}
            onDeclineOath={handleDeclineOath} onStartRequest={handleStartRequest} onNavigateItem={(id) => { setInstructionOpen(false); navigate(`/item/${id}`); }}
            isFreeDay={isFreeDay} freeDayReason={freeDayReason} 
            loadingStatus={instructionStatus === 'idle' ? 'loading' : instructionStatus} 
            isNight={isNight}
            showToast={showToast}
        />
        
        <PunishmentDialog 
            open={punishmentScanOpen} 
            onClose={() => setPunishmentScanOpen(false)} 
            mode={punishmentScanMode} 
            punishmentItem={punishmentItem} 
            isScanning={isNfcScanning} 
            onScan={handlePunishmentScanTrigger} 
        />
        
        <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} fullWidth>
          <DialogTitle>Audit: {pendingAuditItems[currentAuditIndex]?.name}</DialogTitle>
          <DialogContent><TextField type="number" label="Zustand (1-5)" value={currentCondition} onChange={e => setCurrentCondition(parseInt(e.target.value))} fullWidth sx={{mt:2}} /></DialogContent>
          <DialogActions><Button onClick={() => setAuditOpen(false)} color="inherit">Abbrechen</Button><Button onClick={handleConfirmAuditItem} variant="contained" color="warning">Bestätigen</Button></DialogActions>
        </Dialog>
        
        <Dialog open={reflectionOpen} onClose={() => setReflectionOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Reflektion</DialogTitle>
          <DialogContent><FormGroup>{REFLECTION_TAGS.map(t => (<FormControlLabel key={t} control={<Checkbox onChange={() => setSelectedFeelings(prev => prev.includes(t) ? prev.filter(f => f !== t) : [...prev, t])}/>} label={t}/>))}</FormGroup></DialogContent>
          <DialogActions><Button onClick={() => setReflectionOpen(false)} color="inherit">Abbrechen</Button><Button onClick={handleConfirmStopSession}>Bestätigen</Button></DialogActions>
        </Dialog>
        
        <IndexDetailDialog open={indexDialogOpen} onClose={() => setIndexDialogOpen(false)} details={kpis?.femIndex?.details} />
        
        <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}><Alert severity={toast.severity}>{toast.message}</Alert></Snackbar>
      </Container>
    </Box>
  );
}
