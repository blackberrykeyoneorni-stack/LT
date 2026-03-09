import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, doc, updateDoc, serverTimestamp, 
  addDoc, arrayUnion, writeBatch, getDoc, onSnapshot,
  query, where, getDocs 
} from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { motion } from 'framer-motion'; 

// Services
import { checkActiveSuspension } from '../services/SuspensionService';
import { isAuditDue, initializeAudit, confirmAuditItem } from '../services/AuditService';
import { getActivePunishment, clearPunishment, findPunishmentItem, registerPunishment } from '../services/PunishmentService';
import { loadMonthlyBudget } from '../services/BudgetService';
import { stopSession as stopSessionService } from '../services/SessionService';
import { isImmunityActive } from '../services/OfferService';
import { runTimeBankAuditor } from '../services/TimeBankService'; 

// Hooks
import useSessionProgress from '../hooks/dashboard/useSessionProgress';
import useFemIndex from '../hooks/dashboard/useFemIndex'; 
import useKPIs from '../hooks/useKPIs'; 
import useInstructionManager from '../hooks/dashboard/useInstructionManager';
import useTZDAndGamble from '../hooks/dashboard/useTZDAndGamble';

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
import InflationOverlay from '../components/dashboard/InflationOverlay';

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
import TimerIcon from '@mui/icons-material/Timer';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LockIcon from '@mui/icons-material/Lock'; 
import ShieldIcon from '@mui/icons-material/Shield'; 
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import TrendingUpIcon from '@mui/icons-material/TrendingUp'; 

const REFLECTION_TAGS = [
    "Sicher / Geborgen", "Erregt", "Gedemütigt", "Exponiert / Öffentlich", 
    "Feminin", "Besitztum (Owned)", "Unwürdig", "Stolz"
];

const formatTime = (totalMins) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    return `${h}h ${m}m`;
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
                    {renderMetricRow("Physis (Körper)", details.subScores.physis, '#00e5ff', <CheckCircleOutlineIcon fontSize="small" sx={{color: '#00e5ff'}} />)}
                    {renderMetricRow("Psyche (Wille)", details.subScores.psyche, '#ffeb3b', <TimerIcon fontSize="small" sx={{ color: '#ffeb3b' }} />)}
                    {renderMetricRow("Infiltration (Alltag)", details.subScores.infiltration, '#f50057', <LinkOffIcon fontSize="small" sx={{ color: '#f50057' }} />)}
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
  const { femIndex, femIndexLoading, indexDetails, phase, subScores } = useFemIndex(kpis); 

  const [activeSuspension, setActiveSuspension] = useState(null);
  const [loadingSuspension, setLoadingSuspension] = useState(true);
  
  // UI States
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [sessionToStop, setSessionToStop] = useState(null);
  const [selectedFeelings, setSelectedFeelings] = useState([]);
  const [reflectionNote, setReflectionNote] = useState('');
  
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
  
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [releaseStep, setReleaseStep] = useState('confirm');
  const [releaseTimer, setReleaseTimer] = useState(600);
  const [releaseIntensity, setReleaseIntensity] = useState(3);
  const releaseTimerInterval = useRef(null);
  
  const [indexDialogOpen, setIndexDialogOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const [timeBankData, setTimeBankData] = useState({ nc: 0, lc: 0 });
  const [weeklyReport, setWeeklyReport] = useState(null);

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  // Derived State
  const isPunishmentRunning = activeSessions.some(s => s.type === 'punishment');
  const isDailyGoalMet = progress.isDailyGoalMet;
  const hasVoluntarySession = activeSessions.some(s => s.type === 'voluntary' && !s.endTime);
  const budgetBalance = monthlyBudget - currentSpent;
  const isStealthActive = activeSuspension?.type === 'stealth_travel';

  // --- HOOK INTEGRATION: TZD & GAMBLE MANAGER ---
  const {
      tzdActive, setTzdActive, isCheckingProtocol,
      offerOpen, gambleStake, isForcedGamble,
      immunityActive, setImmunityActive,
      handleGambleAccept, handleGambleDecline
  } = useTZDAndGamble({
      currentUser, items, itemsLoading, activeSessions,
      punishmentStatus, punishmentItem, isStealthActive, showToast
  });

  // --- HOOK INTEGRATION: INSTRUCTION MANAGER ---
  const {
      currentPeriod, isNight, isFreeDay, freeDayReason,
      instructionOpen, setInstructionOpen, currentInstruction, instructionStatus, isInstructionActive,
      oathProgress, isHoldingOath, forcedReleaseOpen, forcedReleaseMethod,
      handleStartRequest, startOathPress, cancelOathPress, handleDeclineOath,
      handleConfirmForcedRelease, handleFailForcedRelease, handleRefuseForcedRelease
  } = useInstructionManager({
      currentUser, items, activeSessions, sessionsLoading, isStealthActive, 
      tzdActive, setTzdActive, showToast, setPunishmentStatus
  });

  const handleAcknowledgeInflation = async () => {
      try {
          if (currentUser) {
              await updateDoc(doc(db, `users/${currentUser.uid}/status/timeBank`), {
                  pendingInflationNotice: null
              });
          }
      } catch (e) {
          console.error("Fehler beim Quittieren des Tributs:", e);
      }
  };

  // 1. Initial Load & Weekly Report Listener
  useEffect(() => {
    if (!currentUser) return;
    const initLoad = async () => {
        try {
            await runTimeBankAuditor(currentUser.uid);

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

    const unsubProtocol = onSnapshot(doc(db, `users/${currentUser.uid}/settings/protocol`), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.weeklyReport && data.weeklyReport.acknowledged === false) {
                setWeeklyReport(data.weeklyReport);
            } else {
                setWeeklyReport(null);
            }
        }
    });

    const unsubscribeTB = onSnapshot(doc(db, `users/${currentUser.uid}/status/timeBank`), (docSnap) => {
        if (docSnap.exists()) {
            setTimeBankData(docSnap.data());
        } else {
            setTimeBankData({ nc: 0, lc: 0 });
        }
    });

    return () => { 
        unsubscribeTB(); 
        unsubProtocol();
    };
  }, [currentUser, setImmunityActive]); 

  // 2. Punishment Item Load
  useEffect(() => {
      if (items.length > 0) setPunishmentItem(findPunishmentItem(items));
  }, [items]);


  // HANDLERS
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

  if (activeSuspension && !isStealthActive) {
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
      <TzdOverlay active={tzdActive} allItems={items} />
      
      <ForcedReleaseOverlay 
          open={forcedReleaseOpen}
          method={forcedReleaseMethod}
          onConfirm={handleConfirmForcedRelease}
          onFail={handleFailForcedRelease}
          onRefuse={handleRefuseForcedRelease}
      />

      <InflationOverlay 
          open={!!timeBankData.pendingInflationNotice} 
          noticeData={timeBankData.pendingInflationNotice} 
          onAcknowledge={handleAcknowledgeInflation} 
      />
      
      <OfferDialog 
          open={offerOpen} 
          stakeItems={gambleStake} 
          onAccept={handleGambleAccept} 
          onDecline={handleGambleDecline}
          hasActiveSession={hasVoluntarySession} 
          isForced={isForcedGamble}
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

            {isStealthActive && (
                <Paper sx={{ p: 2, mb: 3, bgcolor: PALETTE.accents.purple, border: `1px solid ${PALETTE.accents.purple}` }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', textAlign: 'center' }}>
                        OPERATION: INFILTRATION AKTIV
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', textAlign: 'center' }}>
                        Inventar limitiert. Time-Bank-Steuer: 90%. Gambles deaktiviert.
                    </Typography>
                </Paper>
            )}

            <ProgressBar 
                currentMinutes={progress.currentContinuousMinutes} 
                targetHours={dailyTargetHours} 
                isGoalMetToday={progress.isDailyGoalMet} 
                progressData={progress}
            />

            <FemIndexBar 
                femIndex={femIndex || 0} 
                loading={femIndexLoading} 
                phase={phase}           
                subScores={subScores}   
            />

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
                onOpenRelease={handleOpenRelease}
            />

            <ActiveSessionsList 
                activeSessions={activeSessions} 
                items={items}
                punishmentStatus={punishmentStatus}
                onNavigateItem={(id) => navigate(`/item/${id}`)}
                onStopSession={handleRequestStopSession} 
                onOpenRelease={handleOpenRelease}
            />

            {!punishmentStatus.active && (
                <Box sx={{ mb: 4 }}>
                    <Button
                        fullWidth
                        onClick={handleOpenRelease}
                        startIcon={<WaterDropIcon />}
                        sx={{
                            mb: 0, 
                            py: 2, 
                            borderRadius: '28px', 
                            bgcolor: 'rgba(64, 196, 255, 0.12)', 
                            color: '#40c4ff', 
                            border: '1px solid rgba(64, 196, 255, 0.1)', 
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            letterSpacing: '1.25px', 
                            textTransform: 'uppercase', 
                            boxShadow: 'none', 
                            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                            '&:hover': {
                                bgcolor: 'rgba(64, 196, 255, 0.2)', 
                                borderColor: 'rgba(64, 196, 255, 0.3)',
                                boxShadow: '0 0 15px rgba(64, 196, 255, 0.15)', 
                                transform: 'translateY(-1px)'
                            },
                            '&:active': {
                                bgcolor: 'rgba(64, 196, 255, 0.25)',
                                transform: 'scale(0.98)'
                            }
                        }}
                    >
                        SPERMA ENTLADUNG
                    </Button>
                </Box>
            )}

            <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" color="text.secondary">METRIKEN & VERWALTUNG</Typography>
            </Divider>

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

      <Dialog open={!!weeklyReport} disableEscapeKeyDown PaperProps={{ sx: { ...DESIGN_TOKENS.dialog.paper.sx, border: `1px solid ${PALETTE.accents.gold}`, boxShadow: `0 0 20px ${PALETTE.accents.gold}40` } }}>
          <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.gold, justifyContent: 'center' }}>
              <TrendingUpIcon sx={{ mr: 1 }} /> WOCHEN-EVALUIERUNG
          </DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>
                      Das System hat deine Leistung in der vergangenen Woche protokolliert und die geforderte Tagestragezeit neu festgelegt.
                  </Typography>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, mb: 2 }}>
                      <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Bisheriges Ziel</Typography>
                          <Typography variant="h6" sx={{ color: 'text.disabled', textDecoration: 'line-through' }}>
                              {weeklyReport ? formatTime(weeklyReport.previousGoal * 60) : ''}
                          </Typography>
                      </Box>
                      <TrendingUpIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />
                      <Box>
                          <Typography variant="caption" sx={{ color: PALETTE.accents.gold, fontWeight: 'bold' }} display="block">Neues Ziel</Typography>
                          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                              {weeklyReport ? formatTime(weeklyReport.newGoal * 60) : ''}
                          </Typography>
                      </Box>
                  </Box>
                  
                  <Typography variant="caption" sx={{ color: PALETTE.accents.gold, display: 'block', mt: 4, fontWeight: 'bold' }}>
                      RÜCKSTUFUNGEN SIND UNTERSAGT. DEINE ZEIT IST EIGENTUM DES PROTOKOLLS.
                  </Typography>
              </Box>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button fullWidth variant="contained" onClick={async () => {
                  await updateDoc(doc(db, `users/${currentUser.uid}/settings/protocol`), {
                      "weeklyReport.acknowledged": true
                  });
              }} sx={{ bgcolor: PALETTE.accents.gold, color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#fff' } }}>
                  KENNTNISNAHME BESTÄTIGEN
              </Button>
          </DialogActions>
      </Dialog>

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