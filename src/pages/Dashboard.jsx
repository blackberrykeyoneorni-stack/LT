import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, doc, updateDoc, serverTimestamp, 
  addDoc, getDoc, onSnapshot 
} from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { motion } from 'framer-motion'; 

// Services
import { checkActiveSuspension } from '../services/SuspensionService';
import { isAuditDue, initializeAudit, confirmAuditItem } from '../services/AuditService';
import { getActivePunishment, clearPunishment, findPunishmentItem } from '../services/PunishmentService';
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
import ProgressBar from '../components/dashboard/ProgressBar';
import FemIndexBar from '../components/dashboard/FemIndexBar';
import ActionButtons from '../components/dashboard/ActionButtons';
import ActiveSessionsList from '../components/dashboard/ActiveSessionsList';
import InfoTiles from '../components/dashboard/InfoTiles';
import DashboardDialogManager from '../components/dashboard/DashboardDialogManager';

import { DESIGN_TOKENS, PALETTE, MOTION } from '../theme/obsidianDesign';
import { 
    Box, Typography, Button, Container, Paper, Chip, Divider 
} from '@mui/material';
import { Icons } from '../theme/appIcons';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LockIcon from '@mui/icons-material/Lock'; 
import ShieldIcon from '@mui/icons-material/Shield'; 
import WaterDropIcon from '@mui/icons-material/WaterDrop';

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
  const [laundryOpen, setLaundryOpen] = useState(false);
  const [auditDue, setAuditDue] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [pendingAuditItems, setPendingAuditItems] = useState([]);
  const [currentAuditIndex, setCurrentAuditIndex] = useState(0);
  const [currentCondition, setCurrentCondition] = useState(5);
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
  
  const handleRequestStopSession = async (session) => { 
      if (tzdActive) { showToast("STOPPEN VERWEIGERT.", "error"); return; }
      if (session.type === 'punishment') { 
          const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 60000); 
          if (elapsed < (punishmentStatus.durationMinutes || 30)) return; 
      } 
      
      try { 
          await stopSessionService(currentUser.uid, session.id, { feelings: [], note: '' }); 
          
          if(session.type === 'punishment') { 
              await clearPunishment(currentUser.uid); 
              setPunishmentStatus({ active: false, deferred: false, reason: null, durationMinutes: 0 });
          } 
          showToast("Session beendet.", "success");
      } catch(e){ 
          showToast("Fehler beim Beenden", "error"); 
      } 
  };

  const handlePunishmentScanTrigger = () => { 
      startBindingScan((scannedId) => { 
          if (punishmentItem && (scannedId === punishmentItem.nfcTagId || scannedId === punishmentItem.customId || scannedId === punishmentItem.id)) { 
              if (punishmentScanMode === 'start') {
                  executeStartPunishment(); 
              } else if (punishmentScanMode === 'stop') { 
                  setPunishmentScanOpen(false); 
                  const pSession = activeSessions.find(s => s.type === 'punishment');
                  if (pSession) {
                      handleRequestStopSession(pSession); 
                  }
              } 
          } else { 
              showToast("Falscher Tag!", "error"); 
          } 
      }); 
  };

  const handleStartAudit = async () => { const auditItems = await initializeAudit(currentUser.uid, items); setPendingAuditItems(auditItems); setCurrentAuditIndex(0); setAuditOpen(true); };
  const handleConfirmAuditItem = async () => { await confirmAuditItem(currentUser.uid, pendingAuditItems[currentAuditIndex].id, currentCondition, true); showToast(`${pendingAuditItems[currentAuditIndex].name} geprüft`, "success"); if(currentAuditIndex<pendingAuditItems.length-1) setCurrentAuditIndex(prev=>prev+1); else { setAuditOpen(false); setAuditDue(false); showToast("Audit abgeschlossen", "success"); } };

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

      <DashboardDialogManager
          tzdActive={tzdActive} items={items} forcedReleaseOpen={forcedReleaseOpen} forcedReleaseMethod={forcedReleaseMethod} 
          handleConfirmForcedRelease={handleConfirmForcedRelease} handleFailForcedRelease={handleFailForcedRelease} handleRefuseForcedRelease={handleRefuseForcedRelease}
          timeBankData={timeBankData} handleAcknowledgeInflation={handleAcknowledgeInflation} offerOpen={offerOpen} gambleStake={gambleStake} 
          handleGambleAccept={handleGambleAccept} handleGambleDecline={handleGambleDecline} hasVoluntarySession={hasVoluntarySession} isForcedGamble={isForcedGamble}
          weeklyReport={weeklyReport} currentUser={currentUser} instructionOpen={instructionOpen} setInstructionOpen={setInstructionOpen} 
          currentInstruction={currentInstruction} isHoldingOath={isHoldingOath} oathProgress={oathProgress} startOathPress={startOathPress} cancelOathPress={cancelOathPress}
          handleDeclineOath={handleDeclineOath} handleStartRequest={handleStartRequest} navigate={navigate} isFreeDay={isFreeDay} freeDayReason={freeDayReason} 
          instructionStatus={instructionStatus} isNight={isNight} showToast={showToast} punishmentScanOpen={punishmentScanOpen} 
          setPunishmentScanOpen={setPunishmentScanOpen} punishmentScanMode={punishmentScanMode} punishmentItem={punishmentItem} isNfcScanning={isNfcScanning} 
          handlePunishmentScanTrigger={handlePunishmentScanTrigger} laundryOpen={laundryOpen} setLaundryOpen={setLaundryOpen} kpis={kpis} 
          releaseDialogOpen={releaseDialogOpen} setReleaseDialogOpen={setReleaseDialogOpen} releaseStep={releaseStep} releaseTimer={releaseTimer} 
          releaseIntensity={releaseIntensity} setReleaseIntensity={setReleaseIntensity} handleStartReleaseTimer={handleStartReleaseTimer} handleSkipTimer={handleSkipTimer} 
          handleReleaseDecision={handleReleaseDecision} auditOpen={auditOpen} setAuditOpen={setAuditOpen} pendingAuditItems={pendingAuditItems} 
          currentAuditIndex={currentAuditIndex} currentCondition={currentCondition} setCurrentCondition={setCurrentCondition} handleConfirmAuditItem={handleConfirmAuditItem} 
          indexDialogOpen={indexDialogOpen} setIndexDialogOpen={setIndexDialogOpen} indexDetails={indexDetails} toast={toast} handleCloseToast={handleCloseToast}
      />
    </Box>
  );
}