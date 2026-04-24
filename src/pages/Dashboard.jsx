// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, doc, updateDoc, serverTimestamp, 
  addDoc, getDoc, onSnapshot, query, where 
} from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { motion } from 'framer-motion'; 

// Services
import { checkActiveSuspension } from '../services/SuspensionService';
import { isAuditDue, initializeAudit, confirmAuditItem } from '../services/AuditService';
import { getActivePunishment, clearPunishment, executePunishmentTicket } from '../services/PunishmentService';
import { loadMonthlyBudget } from '../services/BudgetService';
import { stopSession as stopSessionService, startSession as startSessionService } from '../services/SessionService';
import { isImmunityActive } from '../services/OfferService';
import { runTimeBankAuditor, spendCredits } from '../services/TimeBankService'; 
import { getUniformityStatus } from '../services/UniformityService';

// Hooks
import useSessionProgress from '../hooks/dashboard/useSessionProgress';
import useFemIndex from '../hooks/dashboard/useFemIndex'; 
import useKPIs from '../hooks/useKPIs'; 
import useInstructionManager from '../hooks/dashboard/useInstructionManager';
import useTZDAndGamble from '../hooks/dashboard/useTZDAndGamble';
import useUIStore from '../store/uiStore';
import { useDashboardActions } from '../hooks/dashboard/useDashboardActions';

// Components
import ProgressBar from '../components/dashboard/ProgressBar';
import FemIndexBar from '../components/dashboard/FemIndexBar';
import ActionButtons from '../components/dashboard/ActionButtons';
import ActiveSessionsList from '../components/dashboard/ActiveSessionsList';
import InfoTiles from '../components/dashboard/InfoTiles';
import DashboardDialogManager from '../components/dashboard/DashboardDialogManager';
import UniformityReleaseDialog from '../components/dialogs/ReleaseProtocolDialog'; 

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

  // Logic Hooks
  const { washingItems, handleWashItem, handleWashAll } = useDashboardActions();
  const { activeSessions, progress, loading: sessionsLoading, dailyTargetHours, registerRelease: hookRegisterRelease } = useSessionProgress(currentUser, items);
  const kpis = useKPIs(items, activeSessions);
  const { femIndex, femIndexLoading, indexDetails, phase, subScores } = useFemIndex(kpis);

  // Store Connections (Zentraler Controller)
  const { 
      showToast, 
      setInstructionOpen, 
      setOathProgress, 
      isHoldingOath, setIsHoldingOath,
      setForcedReleaseOpen, 
      setForcedReleaseMethod 
  } = useUIStore();

  const [activeSuspension, setActiveSuspension] = useState(null);
  const [loadingSuspension, setLoadingSuspension] = useState(true);
  
  // Local States
  const [auditDue, setAuditDue] = useState(false);
  const [punishmentStatus, setPunishmentStatus] = useState({ active: false, deferred: false, reason: null, durationMinutes: 0 });
  const [pendingPunishments, setPendingPunishments] = useState([]);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0); 
  const [maxInstructionItems, setMaxInstructionItems] = useState(1);
  const releaseTimerInterval = useRef(null);
  const oathTimerRef = useRef(null); 
  
  const [timeBankData, setTimeBankData] = useState({ nc: 0, lc: 0 });
  const [weeklyReport, setWeeklyReport] = useState(null);
  
  // --- ERZWUNGENE MONOTONIE STATE ---
  const [uniformity, setUniformity] = useState({ active: false });

  // Derived State
  const isPunishmentRunning = (activeSessions || []).some(s => s.type === 'punishment');
  const isDailyGoalMet = progress.isDailyGoalMet;
  const hasVoluntarySession = (activeSessions || []).some(s => s.type === 'voluntary' && !s.endTime);
  const budgetBalance = monthlyBudget - currentSpent;
  const isStealthActive = activeSuspension?.type === 'stealth_travel';

  // --- SCHULDEN-LOGIK (Irreversible Debt Protocol) ---
  const ncDebt = timeBankData.nc < 0 ? Math.abs(timeBankData.nc) : 0;
  const lcDebt = timeBankData.lc < 0 ? Math.abs(timeBankData.lc) : 0;
  const inDebt = ncDebt > 0 || lcDebt > 0;
  const debtMinDuration = Math.max(ncDebt, lcDebt);
  const hasActiveDebtSession = (activeSessions || []).some(s => s.type === 'debt' || s.isDebtSession);

  // --- GETRENNTE LOCKDOWN LOGIK ---
  const isActionButtonsLocked = inDebt; 
  const isPrivilegeLocked = inDebt || uniformity.active;

  // --- HOOK INTEGRATION: TZD & GAMBLE MANAGER ---
  const {
      tzdActive, setTzdActive, isCheckingProtocol,
      gambleOffer, 
      immunityActive, setImmunityActive,
      handleGambleAccept, handleGambleDecline
  } = useTZDAndGamble({
      currentUser, items, itemsLoading, activeSessions,
      punishmentStatus, punishmentItem: null, isStealthActive, showToast
  });

  const offerOpen = gambleOffer !== null;
  const gambleStake = gambleOffer?.stake || [];
  const isForcedGamble = gambleOffer?.isForced || false;

  // --- HOOK INTEGRATION: INSTRUCTION MANAGER ---
  const {
      currentPeriod, isNight, isFreeDay, freeDayReason,
      currentInstruction, instructionStatus, isInstructionActive,
      handleStartRequest, handleAcceptOath, handleDeclineOath,
      handleConfirmForcedRelease, handleFailForcedRelease, handleRefuseForcedRelease
  } = useInstructionManager({
      currentUser, items, activeSessions, sessionsLoading, isStealthActive, 
      tzdActive, setTzdActive, showToast, setPunishmentStatus,
      onEvasionDetected: () => setInstructionOpen(false),
      onForcedReleaseDue: (method) => {
          setForcedReleaseMethod(method);
          setForcedReleaseOpen(true);
      },
      onInstructionStarted: () => setInstructionOpen(false),
      onOathAccepted: () => setIsHoldingOath(false),
      onOathRefused: () => {
          setInstructionOpen(false);
          setIsHoldingOath(false);
      },
      onReleaseResolved: () => setForcedReleaseOpen(false)
  });

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
  }, [handleAcceptOath, setIsHoldingOath, setOathProgress]);

  const cancelOathPress = useCallback(() => { 
      clearInterval(oathTimerRef.current); 
      setIsHoldingOath(false); 
      setOathProgress(0); 
  }, [setIsHoldingOath, setOathProgress]);

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

  const handleBuyDiscount = async (minutesToBuy) => {
      if (uniformity.active) {
          showToast("Freikauf verweigert. In Straf-Uniform keine Privilegien.", "error");
          return;
      }

      if (!currentUser || !currentInstruction || !currentInstruction.items || currentInstruction.items.length === 0) {
          showToast("Freikauf gescheitert. Keine aktive Anweisung gefunden.", "error");
          return;
      }

      let hasNylon = false;
      let hasLingerie = false;

      currentInstruction.items.forEach(item => {
          const mainCat = (item.mainCategory || '').toLowerCase();
          if (mainCat === 'nylons' || mainCat === 'nylon') hasNylon = true;
          if (mainCat === 'dessous' || mainCat === 'lingerie') hasLingerie = true;
      });

      let paymentType = null;
      if (hasNylon && hasLingerie) paymentType = 'both';
      else if (hasNylon && !hasLingerie) paymentType = 'nylon';
      else if (!hasNylon && hasLingerie) paymentType = 'lingerie';
      else {
          showToast("Freikauf gescheitert. Weder Nylons noch Lingerie aktiv.", "error");
          return;
      }

      try {
          await spendCredits(currentUser.uid, minutesToBuy, paymentType);

          const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
          const instrSnap = await getDoc(instrRef);

          if (instrSnap.exists()) {
              const data = instrSnap.data();
              const currentDiscount = data.discountMinutes || 0;
              const newDiscount = currentDiscount + minutesToBuy;
              
              await updateDoc(instrRef, { discountMinutes: newDiscount });

              let successMessage = `Freikauf autorisiert (-${minutesToBuy} Min).`;
              if (paymentType === 'both') successMessage = `Freikauf autorisiert (-${minutesToBuy} Min).\nSystem erzwang kombinierte LC & NC Zahlung.`;
              else if (paymentType === 'nylon') successMessage = `Freikauf autorisiert (-${minutesToBuy} Min).\nSystem erzwang NC Zahlung.`;
              else if (paymentType === 'lingerie') successMessage = `Freikauf autorisiert (-${minutesToBuy} Min). System erzwang LC Zahlung.`;

              showToast(successMessage, "success");
          }
      } catch (e) {
          if (e.message === "INSOLVENCY_LIMIT_REACHED") showToast("Freikauf verweigert. Kreditlimit (Insolvenz) des erzwungenen Kontos erreicht.", "error");
          else showToast("Systemfehler beim Freikauf.", "error");
      }
  };

  useEffect(() => {
    if (!currentUser) return;
    const initLoad = async () => {
        try {
            const [
                _, pSnap, statusData, auditResult, budgetResult, bSnap, suspResult, immuneResult
            ] = await Promise.all([
              runTimeBankAuditor(currentUser.uid),
                getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`)),
                getActivePunishment(currentUser.uid),
                isAuditDue(currentUser.uid),
                loadMonthlyBudget(currentUser.uid),
                getDoc(doc(db, `users/${currentUser.uid}/settings/budget`)),
                checkActiveSuspension(currentUser.uid),
                isImmunityActive(currentUser.uid)
            ]);

            if(pSnap.exists()) setMaxInstructionItems(pSnap.data().maxInstructionItems || 1);
            setPunishmentStatus(statusData || { active: false });
            setAuditDue(auditResult);
            setMonthlyBudget(budgetResult);
            if(bSnap.exists()) setCurrentSpent(bSnap.data().currentSpent || 0);
            setActiveSuspension(suspResult);
            setImmunityActive(immuneResult);

        } catch(e) { console.error(e); } 
        finally { setLoadingSuspension(false); }
    };
    initLoad();

    const unsubProtocol = onSnapshot(doc(db, `users/${currentUser.uid}/settings/protocol`), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setWeeklyReport((data.weeklyReport && data.weeklyReport.acknowledged === false) ? data.weeklyReport : null);
        }
    });

    const unsubscribeTB = onSnapshot(doc(db, `users/${currentUser.uid}/status/timeBank`), (docSnap) => {
        setTimeBankData(docSnap.exists() ? docSnap.data() : { nc: 0, lc: 0 });
    });

    const unsubLedger = onSnapshot(
        query(collection(db, `users/${currentUser.uid}/punishmentLedger`), where('status', '==', 'pending')),
        (snap) => {
            const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
            setPendingPunishments(tickets);
        }
    );

    return () => { 
        unsubscribeTB(); 
        unsubProtocol();
        unsubLedger();
    };
  }, [currentUser, setImmunityActive]);

  useEffect(() => {
    if (currentUser) {
        getUniformityStatus(currentUser.uid).then(status => setUniformity(status));
    }
  }, [currentUser, activeSessions]);

  const handlePunishmentScanTrigger = async (ticketId, instrumentType, instrumentItem, isManual = false) => { 
      const executeAndClose = async () => {
          useUIStore.getState().setPunishmentScanOpen(false);
          const result = await executePunishmentTicket(currentUser.uid, ticketId, instrumentType, instrumentItem.id);
          
          if (result.success) {
              setPunishmentStatus({ active: true, durationMinutes: result.duration });
              useUIStore.getState().showToast(`Vollzug autorisiert. Das System hat das Urteil fällen lassen.`, "error");
          } else {
              useUIStore.getState().showToast(result.error, "error");
          }
      };

      if (isManual) {
          await executeAndClose();
      } else {
          startBindingScan(async (scannedId) => { 
              if (instrumentItem && (scannedId === instrumentItem.nfcTagId || scannedId === instrumentItem.customId || scannedId === instrumentItem.id)) { 
                  const scanMode = useUIStore.getState().punishmentScanMode;
                  if (scanMode === 'start') {
                      await executeAndClose();
                  } 
              } else { 
                  useUIStore.getState().showToast("Falscher Tag oder falsches Instrument!", "error"); 
              } 
          });
      }
  };

  const handleRequestStopSession = async (session, options = {}) => { 
      if (tzdActive) { showToast("STOPPEN VERWEIGERT.", "error"); return; }
      
      try { 
          await stopSessionService(currentUser.uid, session.id, { feelings: [], note: '', ...options });
          if(session.type === 'punishment') { 
              await clearPunishment(currentUser.uid);
              setPunishmentStatus({ active: false, deferred: false, reason: null, durationMinutes: 0 });
          } 
          
          if (options.emergencyBailout) {
              showToast("Not-Abbruch! Strafaufschlag angewendet.", "error");
          } else {
              showToast("Session beendet.", "success");
          }
      } catch(e){ 
          showToast("Fehler beim Beenden", "error");
      } 
  };

  const handleStartAudit = async () => { 
      const auditItems = await initializeAudit(currentUser.uid, items);
      useUIStore.getState().setPendingAuditItems(auditItems); 
      useUIStore.getState().setCurrentAuditIndex(0); 
      useUIStore.getState().setAuditOpen(true); 
  };

  const handleConfirmAuditItem = async () => { 
      const { pendingAuditItems, currentAuditIndex, currentCondition, setAuditOpen, showToast, setCurrentAuditIndex } = useUIStore.getState();
      await confirmAuditItem(currentUser.uid, pendingAuditItems[currentAuditIndex].id, currentCondition, true); 
      showToast(`${pendingAuditItems[currentAuditIndex].name} geprüft`, "success"); 
      if(currentAuditIndex < pendingAuditItems.length - 1) {
          setCurrentAuditIndex(prev => prev + 1);
      } else { 
          setAuditOpen(false); 
          setAuditDue(false); 
          showToast("Audit abgeschlossen", "success");
      } 
  };

  const handleOpenRelease = () => { 
      useUIStore.getState().setReleaseStep('confirm'); 
      useUIStore.getState().setReleaseTimer(600); 
      useUIStore.getState().setReleaseIntensity(3); 
      useUIStore.getState().setReleaseDialogOpen(true);
  };

  const handleStartReleaseTimer = () => { 
      useUIStore.getState().setReleaseStep('timer'); 
      if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current);
      releaseTimerInterval.current = setInterval(() => { 
          useUIStore.getState().setReleaseTimer(prev => { 
              if(prev <= 1) { 
                  clearInterval(releaseTimerInterval.current); 
                  useUIStore.getState().setReleaseStep('decision'); 
                  return 0; 
              } 
              return prev - 1; 
          }); 
      }, 1000);
  };

  const handleSkipTimer = () => { 
      if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); 
      useUIStore.getState().setReleaseStep('decision'); 
  };

  const handleReleaseDecision = async (outcome) => { 
      try { 
          await hookRegisterRelease(outcome, useUIStore.getState().releaseIntensity);
          if (outcome === 'maintained') useUIStore.getState().showToast("Disziplin bewiesen.", "success"); 
          else useUIStore.getState().showToast("Sessions beendet.", "warning");
      } catch (e) { 
          useUIStore.getState().showToast("Fehler beim Release", "error");
      } finally { 
          useUIStore.getState().setReleaseDialogOpen(false); 
          if(releaseTimerInterval.current) clearInterval(releaseTimerInterval.current); 
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

            {/* UNIFORMITY BLOCK */}
            {uniformity.active && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(211, 47, 47, 0.1)', border: `1px solid ${PALETTE.accents.red}` }}>
                    <Typography variant="subtitle1" color="error" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                        <LockIcon sx={{ mr: 1 }}/> ERZWUNGENE MONOTONIE AKTIV
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Inventar verriegelt. Nur die Straf-Uniform ist zulässig. Erfülle deine regulären Anweisungen, danach darfst du ablegen. Freiwillige Sessions und Privilegien sind für 96h deaktiviert.
                    </Typography>
                </Paper>
            )}

            {/* SCHULDENTILGUNG BLOCK */}
            {inDebt && !hasActiveDebtSession && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(211, 47, 47, 0.1)', border: `1px solid ${PALETTE.accents.red}` }}>
                    <Typography variant="subtitle1" color="error" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                        <LockIcon sx={{ mr: 1 }}/> SCHULDENTILGUNG ERFORDERLICH
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Dein Konto ist im Minus (NC: {timeBankData.nc}, LC: {timeBankData.lc}).
                        Alle regulären Funktionen sind gesperrt, bis die Tilgung gestartet ist.
                    </Typography>
                    <Button 
                        variant="contained" 
                        color="error" 
                        fullWidth 
                        onClick={async () => {
                            let requiredItems = [];
                            
                            // HYBRID-ZWANG: Tilgung zwingt zur Straf-Uniform, falls aktiv
                            if (uniformity.active && uniformity.itemIds) {
                                requiredItems = items.filter(i => uniformity.itemIds.includes(i.id));
                            } else {
                                const activeItems = items.filter(i => i.status === 'active');
                                if (ncDebt > 0) {
                                    let nylon = activeItems.find(i => {
                                        const mCat = (i.mainCategory || '').toLowerCase();
                                        return mCat === 'nylons' || mCat === 'nylon';
                                    });
                                    if (!nylon) {
                                        nylon = items.find(i => i.status === 'washing' && ((i.mainCategory || '').toLowerCase() === 'nylons' || (i.mainCategory || '').toLowerCase() === 'nylon'));
                                    }
                                    if (nylon) requiredItems.push(nylon);
                                }
                                if (lcDebt > 0) {
                                    let lingerie = activeItems.find(i => {
                                        const mCat = (i.mainCategory || '').toLowerCase();
                                        return mCat === 'dessous' || mCat === 'lingerie';
                                    });
                                    if (!lingerie) {
                                        lingerie = items.find(i => i.status === 'washing' && ((i.mainCategory || '').toLowerCase() === 'dessous' || (i.mainCategory || '').toLowerCase() === 'lingerie'));
                                    }
                                    if (lingerie) requiredItems.push(lingerie);
                                }
                            }
                            
                            if (requiredItems.length === 0) {
                                showToast("Fehler: Keine Items verfügbar. Bitte System-Administrator kontaktieren.", "error");
                                return;
                            }

                            try {
                                await startSessionService(currentUser.uid, {
                                    items: requiredItems,
                                    type: 'debt',
                                    minDuration: debtMinDuration,
                                    note: 'Erzwungene Schuldentilgung'
                                });
                                showToast("Tilgungs-Session gestartet.", "success");
                            } catch (e) {
                                showToast(e.message || "Fehler beim Starten.", "error");
                            }
                        }}
                        sx={{ fontWeight: 'bold' }}
                    >
                        TILGUNG STARTEN ({debtMinDuration} MIN)
                    </Button>
                </Paper>
            )}

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

            {/* Hier greift der Action-Lockdown (nur Schulden sperren Aktionen) */}
            <Box sx={{ opacity: isActionButtonsLocked ? 0.4 : 1, pointerEvents: isActionButtonsLocked ? 'none' : 'auto' }}>
                <ActionButtons 
                    punishmentStatus={punishmentStatus} 
                    punishmentRunning={isPunishmentRunning}
                    pendingPunishments={pendingPunishments}
                    isStealthActive={isStealthActive}
                    auditDue={auditDue}
                    isFreeDay={isFreeDay}
                    freeDayReason={freeDayReason}
                    currentInstruction={currentInstruction}
                    currentPeriod={currentPeriod}
                    isHoldingOath={isHoldingOath}
                    isInstructionActive={isInstructionActive}
                    isDailyGoalMet={isDailyGoalMet}
                    tzdActive={tzdActive}
                    onOpenInstruction={() => useUIStore.getState().setInstructionOpen(true)}
                    onStartPunishment={() => {
                        useUIStore.getState().setPunishmentScanMode('start');
                        useUIStore.getState().setPunishmentScanOpen(true); 
                    }}
                    onStartAudit={handleStartAudit}
                    onOpenRelease={handleOpenRelease}
                />
            </Box>

            <ActiveSessionsList 
                activeSessions={activeSessions || []} 
                items={items || []}
                onNavigateItem={(id) => navigate(`/item/${id}`)}
                onStopSession={handleRequestStopSession} 
                onOpenRelease={handleOpenRelease}
            />

            {!isPunishmentRunning && (
                <Box sx={{ mb: 4, opacity: isPrivilegeLocked ? 0.4 : 1, pointerEvents: isPrivilegeLocked ? 'none' : 'auto' }}>
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

            <InfoTiles 
                kpis={kpis} 
                timeBank={timeBankData} 
                onBuyDiscount={handleBuyDiscount} 
            />

            <Button
              variant="contained" fullWidth size="large" onClick={() => useUIStore.getState().setLaundryOpen(true)}
              sx={{ 
                  mb: 2, mt: 3, py: 2, bgcolor: 'rgba(255,255,255,0.05)', color: 'text.primary', boxShadow: 'none', justifyContent: 'space-between', px: 3,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', boxShadow: 'none' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><LocalLaundryServiceIcon /><Typography variant="button" sx={{ fontWeight: 'bold' }}>Wäschekorb</Typography></Box>
              <Chip label={`${washingItems.length} Stk.`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'text.primary', fontWeight: 'bold', borderRadius: '4px' }} />
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
          tzdActive={tzdActive} items={items || []} 
          washingItems={washingItems} onWashItem={handleWashItem} onWashAll={handleWashAll}
          handleConfirmForcedRelease={handleConfirmForcedRelease} handleFailForcedRelease={handleFailForcedRelease} handleRefuseForcedRelease={handleRefuseForcedRelease}
          timeBankData={timeBankData} handleAcknowledgeInflation={handleAcknowledgeInflation} offerOpen={offerOpen} gambleStake={gambleStake} 
          handleGambleAccept={() => {
              if (uniformity.active) {
                  showToast("Gamble verweigert. In Straf-Uniform keine Privilegien.", "error");
                  return;
              }
              handleGambleAccept();
          }} 
          handleGambleDecline={handleGambleDecline} hasVoluntarySession={hasVoluntarySession} isForcedGamble={isForcedGamble}
          weeklyReport={weeklyReport} currentUser={currentUser} 
          currentInstruction={currentInstruction} startOathPress={startOathPress} cancelOathPress={cancelOathPress}
          handleDeclineOath={handleDeclineOath} handleStartRequest={handleStartRequest} navigate={navigate} isFreeDay={isFreeDay} freeDayReason={freeDayReason} 
          instructionStatus={instructionStatus} isNight={isNight} showToast={showToast} 
          punishmentItem={null} pendingPunishments={pendingPunishments} isNfcScanning={isNfcScanning} 
          handlePunishmentScanTrigger={handlePunishmentScanTrigger} kpis={kpis} 
          handleStartReleaseTimer={handleStartReleaseTimer} handleSkipTimer={handleSkipTimer} 
          handleReleaseDecision={handleReleaseDecision} 
          handleConfirmAuditItem={handleConfirmAuditItem} 
          indexDetails={indexDetails} activeSessions={activeSessions || []} 
      />

      <UniformityReleaseDialog 
          open={uniformity.active && uniformity.expiresAt && new Date() >= (typeof uniformity.expiresAt.toDate === 'function' ? uniformity.expiresAt.toDate() : new Date(uniformity.expiresAt))} 
          statusData={uniformity}
          onReleased={() => setUniformity({ active: false })}
      />
    </Box>
  );
}