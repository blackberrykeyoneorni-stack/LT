// src/pages/Dashboard.jsx
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
import { runTimeBankAuditor, spendCredits } from '../services/TimeBankService'; 

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

  // Store Connections
  const showToast = useUIStore(s => s.showToast);
  const isHoldingOath = useUIStore(s => s.isHoldingOath);

  const [activeSuspension, setActiveSuspension] = useState(null);
  const [loadingSuspension, setLoadingSuspension] = useState(true);
  
  // Verbleibende lokale Logic-States
  const [auditDue, setAuditDue] = useState(false);
  const [punishmentStatus, setPunishmentStatus] = useState({ active: false, deferred: false, reason: null, durationMinutes: 0 });
  const [punishmentItem, setPunishmentItem] = useState(null);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0); 
  const [maxInstructionItems, setMaxInstructionItems] = useState(1);
  const releaseTimerInterval = useRef(null);
  
  const [timeBankData, setTimeBankData] = useState({ nc: 0, lc: 0 });
  const [weeklyReport, setWeeklyReport] = useState(null);

  // Derived State
  const isPunishmentRunning = (activeSessions || []).some(s => s.type === 'punishment');
  const isDailyGoalMet = progress.isDailyGoalMet;
  const hasVoluntarySession = (activeSessions || []).some(s => s.type === 'voluntary' && !s.endTime);
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
      currentInstruction, instructionStatus, isInstructionActive,
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

  // --- KORREKTUR: STRIKTE WÄHRUNGSPARITÄT (Strict Currency Alignment Gatekeeper) ---
  const handleBuyDiscount = async (minutesToBuy) => {
      if (!currentUser || !currentInstruction || !currentInstruction.items || currentInstruction.items.length === 0) {
          showToast("Freikauf gescheitert. Keine aktive Anweisung gefunden.", "error");
          return;
      }

      // 1. DYNAMISCHER SCAN: Analysiere die aktuellen Anweisungs-Items
      let hasNylon = false;
      let hasLingerie = false;

      currentInstruction.items.forEach(item => {
          const mainCat = (item.mainCategory || '').toLowerCase();
          const subCat = (item.subCategory || '').toLowerCase();
          const name = (item.name || '').toLowerCase();

          if (mainCat.includes('nylon') || subCat.includes('strumpfhose') || subCat.includes('tights') || name.includes('strumpfhose')) {
              hasNylon = true;
          }
          if (mainCat.includes('lingerie') || mainCat.includes('dessous') || subCat.includes('höschen') || name.includes('höschen')) {
              hasLingerie = true;
          }
      });

      // 2. DAS KOMPROMISSLOSE WÄHRUNGS-LOCKING
      let paymentType = null;
      if (hasNylon && hasLingerie) {
          paymentType = 'both';
      } else if (hasNylon && !hasLingerie) {
          paymentType = 'nylon';
      } else if (!hasNylon && hasLingerie) {
          paymentType = 'lingerie';
      } else {
          showToast("Freikauf gescheitert. Weder Nylons noch Lingerie aktiv.", "error");
          return;
      }

      try {
          // 3. TRANSAKTION AUSFÜHREN
          // spendCredits wirft einen Error, falls das Konto/die Konten nicht gedeckt sind
          await spendCredits(currentUser.uid, minutesToBuy, paymentType);

          // 4. ATOMARE ANTI-DOUBLE-COUNTING GUTSCHRIFT
          const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
          const instrSnap = await getDoc(instrRef);
          
          if (instrSnap.exists()) {
              const data = instrSnap.data();
              const currentDiscount = data.discountMinutes || 0;
              // Addiere STRIKT NUR den angeforderten Wert (kein Double-Counting)
              const newDiscount = currentDiscount + minutesToBuy;
              
              await updateDoc(instrRef, {
                  discountMinutes: newDiscount
              });

              let successMessage = `Freikauf autorisiert (-${minutesToBuy} Min).`;
              if (paymentType === 'both') {
                  successMessage = `Freikauf autorisiert (-${minutesToBuy} Min). System erzwang kombinierte LC & NC Zahlung.`;
              } else if (paymentType === 'nylon') {
                  successMessage = `Freikauf autorisiert (-${minutesToBuy} Min). System erzwang NC Zahlung.`;
              } else if (paymentType === 'lingerie') {
                  successMessage = `Freikauf autorisiert (-${minutesToBuy} Min). System erzwang LC Zahlung.`;
              }

              showToast(successMessage, "success");
          }
      } catch (e) {
          console.error("Fehler beim Freikauf:", e);
          if (e.message === "INSOLVENCY_LIMIT_REACHED") {
               showToast("Freikauf verweigert. Kreditlimit (Insolvenz) des erzwungenen Kontos erreicht.", "error");
          } else {
               showToast("Systemfehler beim Freikauf.", "error");
          }
      }
  };

  // 1. Initial Load & Weekly Report Listener
  useEffect(() => {
    if (!currentUser) return;
    const initLoad = async () => {
        try {
            // PERFORMANCE FIX: Alle unabhängigen Firebase-Reads parallel ausführen, um den Waterfall-Effekt zu zerstören.
            const [
                _, // runTimeBankAuditor erzeugt keinen direkten Return-Wert für den State
                pSnap,
                statusData,
                auditResult,
                budgetResult,
                bSnap,
                suspResult,
                immuneResult
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

            // States mit den Ergebnissen der parallelen Abfragen füllen
            if(pSnap.exists()) setMaxInstructionItems(pSnap.data().maxInstructionItems || 1);
            setPunishmentStatus(statusData || { active: false });
            setAuditDue(auditResult);
            setMonthlyBudget(budgetResult);
            if(bSnap.exists()) setCurrentSpent(bSnap.data().currentSpent || 0);
            setActiveSuspension(suspResult);
            setImmunityActive(immuneResult);

        } catch(e) { 
            console.error(e); 
        } finally { 
            setLoadingSuspension(false); 
        }
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
      if (items && items.length > 0) setPunishmentItem(findPunishmentItem(items));
  }, [items]);

  // HANDLERS
  const executeStartPunishment = async () => { 
      if(punishmentItem) { 
          await addDoc(collection(db,`users/${currentUser.uid}/sessions`),{ itemId:punishmentItem.id, itemIds:[punishmentItem.id], type:'punishment', startTime:serverTimestamp(), endTime:null }); 
          await updateDoc(doc(db,`users/${currentUser.uid}/status/punishment`),{active:true,deferred:false}); 
          const newStatus = await getActivePunishment(currentUser.uid);
          setPunishmentStatus(newStatus || { active: false }); 
          useUIStore.getState().setPunishmentScanOpen(false); 
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
              const scanMode = useUIStore.getState().punishmentScanMode;
              if (scanMode === 'start') {
                  executeStartPunishment(); 
              } else if (scanMode === 'stop') { 
                  useUIStore.getState().setPunishmentScanOpen(false); 
                  const pSession = (activeSessions || []).find(s => s.type === 'punishment');
                  if (pSession) {
                      handleRequestStopSession(pSession); 
                  }
              } 
          } else { 
              useUIStore.getState().showToast("Falscher Tag!", "error"); 
          } 
      }); 
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
                tzdActive={tzdActive}
                onOpenInstruction={() => useUIStore.getState().setInstructionOpen(true)}
                onStartPunishment={() => {
                    if (punishmentItem?.nfcTagId) { 
                        useUIStore.getState().setPunishmentScanMode('start'); 
                        useUIStore.getState().setPunishmentScanOpen(true); 
                    } 
                    else executeStartPunishment(); 
                }}
                onStartAudit={handleStartAudit}
                onOpenRelease={handleOpenRelease}
            />

            <ActiveSessionsList 
                activeSessions={activeSessions || []} 
                items={items || []}
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
          handleGambleAccept={handleGambleAccept} handleGambleDecline={handleGambleDecline} hasVoluntarySession={hasVoluntarySession} isForcedGamble={isForcedGamble}
          weeklyReport={weeklyReport} currentUser={currentUser} 
          currentInstruction={currentInstruction} startOathPress={startOathPress} cancelOathPress={cancelOathPress}
          handleDeclineOath={handleDeclineOath} handleStartRequest={handleStartRequest} navigate={navigate} isFreeDay={isFreeDay} freeDayReason={freeDayReason} 
          instructionStatus={instructionStatus} isNight={isNight} showToast={showToast} 
          punishmentItem={punishmentItem} isNfcScanning={isNfcScanning} 
          handlePunishmentScanTrigger={handlePunishmentScanTrigger} kpis={kpis} 
          handleStartReleaseTimer={handleStartReleaseTimer} handleSkipTimer={handleSkipTimer} 
          handleReleaseDecision={handleReleaseDecision} 
          handleConfirmAuditItem={handleConfirmAuditItem} 
          indexDetails={indexDetails} activeSessions={activeSessions || []} 
      />
    </Box>
  );
}