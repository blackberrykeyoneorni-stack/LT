import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText,
  Typography, Box, Button, CircularProgress, Avatar,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText, IconButton,
  Slider, Chip, Divider, Alert
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion } from 'framer-motion'; 

import LockIcon from '@mui/icons-material/Lock';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LaunchIcon from '@mui/icons-material/Launch';
import WeekendIcon from '@mui/icons-material/Weekend';
import CelebrationIcon from '@mui/icons-material/Celebration';
import NfcIcon from '@mui/icons-material/Nfc';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; 
import SavingsIcon from '@mui/icons-material/Savings'; 
import TrendingDownIcon from '@mui/icons-material/TrendingDown'; 
import TimerIcon from '@mui/icons-material/Timer';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

import { useNFCGlobal } from '../../contexts/NFCContext';
import { useAuth } from '../../contexts/AuthContext';
import { startSession as startSessionService, stopSession } from '../../services/SessionService';
import { registerPunishment } from '../../services/PunishmentService';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getTimeBankBalance, spendCredits, checkInsolvency } from '../../services/TimeBankService';

const OVERDRAFT_PENALTY = 1.5; 

export default function InstructionDialog({ 
  open, onClose, instruction, items, loadingStatus,
  isNight, isFreeDay, freeDayReason,
  onStartOath, onCancelOath, onDeclineOath, 
  onStartRequest, onNavigateItem,
  oathProgress, isHoldingOath, showToast,
  activeSessions = [] 
}) {
  const { startBindingScan, isScanning, stopScan } = useNFCGlobal();
  const { currentUser } = useAuth();
  
  const [viewState, setViewState] = useState('oath'); 
  
  const [verifiedItemIds, setVerifiedItemIds] = useState([]);
  const [stagingStatus, setStagingStatus] = useState('idle'); 
  
  const [suggestedItem, setSuggestedItem] = useState(null);
  const [hardcoreDialogOpen, setHardcoreDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [hcPrefs, setHcPrefs] = useState({ enabled: false, probability: 15 });
  const [releaseMethod, setReleaseMethod] = useState(null);

  const [credits, setCredits] = useState({ nc: 0, lc: 0 });
  const [creditReduction, setCreditReduction] = useState(0); 
  const [maxReduction, setMaxReduction] = useState(0); 
  const [creditType, setCreditType] = useState('lingerie');
  const [insolvencyData, setInsolvencyData] = useState({ isBlocked: false, currentDebt: 0, remainingCredit: 0 });

  const [projectedCost, setProjectedCost] = useState({ nc: 0, lc: 0 });
  const [isOverdraft, setIsOverdraft] = useState(false);

  const [timeLeftStr, setTimeLeftStr] = useState('');

  const safePeriodId = (instruction?.periodId || "").toLowerCase();
  const isNightProtocol = safePeriodId.includes('night') || isNight;
  const showVault = safePeriodId ? !isNightProtocol : !isNight;

  useEffect(() => {
    if (open) {
        setStagingStatus('idle');
    }
    if (instruction?.isAccepted) {
        setViewState('preparation');
    } else {
        setViewState('oath');
    }
  }, [instruction, open]);

  // Synchronisiert die verifiedItemIds mit der Datenbank, falls man den Dialog schließt und wieder öffnet
  useEffect(() => {
      if (instruction?.periodId && activeSessions?.length > 0) {
          const prepSession = activeSessions.find(s => s.type === 'instruction' && s.periodId === instruction.periodId);
          if (prepSession && prepSession.itemIds) {
              setVerifiedItemIds(prev => {
                  const merged = [...new Set([...prev, ...prepSession.itemIds])];
                  if (merged.length !== prev.length) return merged; 
                  return prev;
              });
          }
      }
  }, [activeSessions, instruction]);

  useEffect(() => {
      if (viewState === 'preparation' && instruction?.acceptedAt) {
          const interval = setInterval(() => {
              const acceptedTime = instruction.acceptedAt.toDate ? instruction.acceptedAt.toDate() : new Date(instruction.acceptedAt);
              const deadline = new Date(acceptedTime.getTime() + 30 * 60000); 
              const now = new Date();
              const diff = deadline - now;
              
              if (diff <= 0) {
                  setTimeLeftStr("00:00 (Überfällig)");
              } else {
                  const m = Math.floor(diff / 60000);
                  const s = Math.floor((diff % 60000) / 1000);
                  setTimeLeftStr(`${m}:${s < 10 ? '0' : ''}${s}`);
              }
          }, 1000);
          return () => clearInterval(interval);
      }
  }, [viewState, instruction]);

  const handleVerifyItem = async (scannedItem) => {
      if (verifiedItemIds.includes(scannedItem.id)) return;
      
      try {
          setVerifiedItemIds(prev => [...prev, scannedItem.id]);
          
          // Wir starten das Item einzeln. Der Service kümmert sich darum, es an die existierende
          // Instruction-Session anzuhängen und die ReadyTime zu setzen, wenn wir komplett sind.
          await startSessionService(currentUser.uid, {
              items: [scannedItem],
              itemId: scannedItem.id,
              type: 'preparation', 
              periodId: instruction.periodId,
              verifiedViaNfc: true,
              acceptedAt: instruction.acceptedAt
          });
          
          if (showToast) showToast(`"${scannedItem.name}" am Körper. Materialzeit läuft.`, "success");
      } catch (e) {
          if (showToast) showToast("Fehler beim Erfassen des Items.", "error");
          setVerifiedItemIds(prev => prev.filter(id => id !== scannedItem.id));
      }
  };

  useEffect(() => {
      if (instruction?.items && verifiedItemIds.length > 0 && verifiedItemIds.length >= instruction.items.length) {
          if (stagingStatus !== 'ready') {
              if (isScanning) stopScan(); 
              setStagingStatus('ready');
          }
      }
  }, [verifiedItemIds, instruction, stagingStatus, isScanning, stopScan]);


  const handleColdFeet = async () => {
      try {
          const q = query(collection(db, `users/${currentUser.uid}/sessions`), where('isActive', '==', true), where('type', '==', 'instruction'));
          const snap = await getDocs(q);
          for (const document of snap.docs) {
               await stopSession(currentUser.uid, document.id, { note: 'Abbruch (Kalte Füße)' });
          }
          
          for (const id of verifiedItemIds) {
               await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), {
                   status: 'washing',
                   cleanDate: null
               });
          }
          
          await registerPunishment(currentUser.uid, "Abbruch im Ankleide-Protokoll (Kalte Füße)", 120);
          
          await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), {
              evasionPenaltyTriggered: true
          });
          
          if (showToast) showToast("Abbruch erfasst. Getragene Items kontaminiert. Strafe aktiv.", "error");
          onClose();
      } catch (e) {
          console.error(e);
          if (showToast) showToast("Systemfehler beim Abbruch.", "error");
      }
  };

  const activateNfcScan = () => {
      if (showToast) showToast("Scanner aktiv. Halte das nächste Item an das Telefon.", "info");
      startBindingScan(handleNfcAutoStart, true);
  };

  const handleNfcAutoStart = async (scannedId) => {
      if (viewState !== 'preparation') return;
      if (!instruction || !instruction.items) return;
      
      const scannedItem = items.find(i => 
          (i.nfcTagId && i.nfcTagId === scannedId) || 
          (i.customId && i.customId === scannedId) ||
          (i.id === scannedId)
      );
      if (!scannedItem) {
          if (showToast) showToast("Unbekanntes Item gescannt.", "warning");
          return;
      }

      let isValid = false;

      if (instruction.transitProtocol && instruction.transitProtocol.active) {
          const transit = instruction.transitProtocol;
          let isLate = false;
          
          if (transit.nightSessionEndTime) {
              const end = new Date(transit.nightSessionEndTime);
              if ((new Date() - end) / 60000 > 30) isLate = true;
          }

          const expectedItemId = isLate ? transit.backupItem.id : transit.primaryItemId;

          if (scannedItem.id === expectedItemId) {
              isValid = true;
          } else if ((instruction?.items || []).some(i => i.id === scannedItem.id && i.id !== transit.primaryItemId)) {
              isValid = true; 
          }

          if (!isValid) {
              if (isLate && scannedItem.id === transit.primaryItemId) {
                   if (showToast) showToast("Transit verpasst (30 Min)! Nacht-Item unrein. Scanne Ersatz.", "error");
                   return;
              } else if (!isLate && scannedItem.id === transit.backupItem.id) {
                   if (showToast) showToast("Transit-Fenster offen. Scanne dein Nacht-Item.", "error");
                   return;
              }
          }
      } else {
          isValid = (instruction?.items || []).some(instrItem => instrItem.id === scannedItem.id);
      }

      if (isValid) {
          await handleVerifyItem(scannedItem);
      } else {
          if (showToast) showToast(`Falsches Item! "${scannedItem.name}" blockiert.`, "error");
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
      }
  };

  const handleCommitment = async () => {
      triggerHardcoreCheck(async () => {
          if (creditReduction > 0) {
             try {
                 await spendCredits(currentUser.uid, creditReduction, creditType);
             } catch(e) {
                 if (showToast) showToast("Kauf fehlgeschlagen.", "error");
                 return; 
             }
          }

          try {
              const newDuration = (instruction.durationMinutes || 0) - creditReduction;
              
              await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), {
                  isAccepted: true,
                  acceptedAt: serverTimestamp(),
                  durationMinutes: newDuration,
                  originalDurationMinutes: instruction.durationMinutes,
                  creditsUsed: creditReduction,
                  wasOverdraft: isOverdraft 
              });
              
              if (showToast) showToast("Akzeptiert. Gehe zur Umkleide.", "success");
              setViewState('preparation');
              onCancelOath(); 

          } catch (e) {
              console.error(e);
              if (showToast) showToast("Fehler beim Akzeptieren.", "error");
          }
      });
  };


  useEffect(() => {
    const loadData = async () => {
        if (!currentUser || !open) return;
        
        try {
            const prefsSnap = await getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`));
            if (prefsSnap.exists()) {
                const data = prefsSnap.data();
                setHcPrefs({
                    enabled: data.sissyProtocolEnabled || false,
                    probability: data.nightReleaseProbability !== undefined ? data.nightReleaseProbability : 15
                });
            }
        } catch (e) { console.error("Error loading prefs", e); }

        if (instruction && !instruction.isAccepted) {
            const balance = await getTimeBankBalance(currentUser.uid);
            setCredits(balance);
            setCreditReduction(0); 
            
            let type = 'lingerie';
            let hasNylon = false;
            let hasLingerie = false;

            if (instruction.items && instruction.items.length > 0) {
                instruction.items.forEach(instrItem => {
                    const fullItem = items.find(i => i.id === instrItem.id);
                    if (fullItem) {
                        const sub = (fullItem.subCategory || '').toLowerCase();
                        const cat = (fullItem.mainCategory || '').toLowerCase();
                        const name = (fullItem.name || '').toLowerCase();
                        
                        if (sub.includes('strumpf') || sub.includes('tights') || 
                            sub.includes('halterlose') || sub.includes('stockings') || 
                            cat.includes('nylon')) {
                            hasNylon = true;
                        }
                        if (cat.includes('dessous') || sub.includes('höschen') || 
                            cat.includes('lingerie') || cat.includes('wäsche') || name.includes('höschen')) {
                            hasLingerie = true;
                        }
                    }
                });

                if (hasNylon && hasLingerie) type = 'both';
                else if (hasNylon) type = 'nylon';
                else if (hasLingerie) type = 'lingerie';
            }
            setCreditType(type);
            
            const insCheckN = await checkInsolvency(currentUser.uid, 'nylon');
            const insCheckL = await checkInsolvency(currentUser.uid, 'lingerie');
            
            let isBlocked = false;
            if (type === 'both') isBlocked = insCheckN.isBlocked || insCheckL.isBlocked;
            else if (type === 'nylon') isBlocked = insCheckN.isBlocked;
            else isBlocked = insCheckL.isBlocked;

            setInsolvencyData({ 
                isBlocked, 
                currentDebt: Math.max(insCheckN.currentDebt, insCheckL.currentDebt) 
            });
        }
    };
    loadData();
  }, [currentUser, open, instruction, items]);

  useEffect(() => {
      if (open) setSuggestedItem(null);
  }, [open]);

  const canSpendCredits = 
      instruction && 
      !instruction.isAccepted && 
      showVault && 
      !insolvencyData.isBlocked;

  useEffect(() => {
      if (canSpendCredits && instruction.durationMinutes) {
          const limitByPolicy = Math.floor(instruction.durationMinutes / 3); 
          setMaxReduction(limitByPolicy > 0 ? limitByPolicy : 0);
      } else {
          setMaxReduction(0);
      }
  }, [canSpendCredits, instruction, insolvencyData]);

  useEffect(() => {
      let costNc = 0; let costLc = 0;
      let overdraftNc = false; let overdraftLc = false;

      if (creditType === 'nylon' || creditType === 'both') {
          if (credits.nc >= creditReduction) costNc = creditReduction;
          else { 
              overdraftNc = true; 
              const covered = Math.max(0, credits.nc);
              const remainder = creditReduction - covered;
              costNc = covered + Math.round(remainder * OVERDRAFT_PENALTY); 
          }
      }

      if (creditType === 'lingerie' || creditType === 'both') {
          if (credits.lc >= creditReduction) costLc = creditReduction;
          else { 
              overdraftLc = true; 
              const covered = Math.max(0, credits.lc);
              const remainder = creditReduction - covered;
              costLc = covered + Math.round(remainder * OVERDRAFT_PENALTY); 
          }
      }

      setProjectedCost({ nc: costNc, lc: costLc });
      setIsOverdraft(overdraftNc || overdraftLc);

  }, [creditReduction, credits, creditType]);

  const triggerHardcoreCheck = (actionToExecute) => {
      if (!isNight || !hcPrefs.enabled) { actionToExecute(); return; }
      
      const roll = Math.random();
      const threshold = hcPrefs.probability / 100;
      
      if (roll < threshold) {
          const methodRoll = Math.random();
          let method = "per Hand"; 
          if (methodRoll >= 0.34 && methodRoll < 0.67) method = "per Masturbator vaginal";
          else if (methodRoll >= 0.67) method = "per Masturbator anal";

          setReleaseMethod(method);
          setPendingAction(() => actionToExecute);
          setHardcoreDialogOpen(true);
      } else { 
          actionToExecute(); 
      }
  };

  const handleHardcoreRefuse = async () => {
      try {
          await registerPunishment(currentUser.uid, "Hardcore-Start verweigert (Entladung)", 30);
          if (showToast) showToast("Verweigerung registriert. Strafe aktiv.", "warning");
      } catch (e) { console.error(e);
      } finally {
          setHardcoreDialogOpen(false);
          if (pendingAction) pendingAction();
          setPendingAction(null);
      }
  };

  const handleHardcoreAccept = () => {
      if (showToast) showToast("Brav. Instruction akzeptiert.", "success");
      setHardcoreDialogOpen(false);
      if (pendingAction) pendingAction();
      setPendingAction(null);
  };

  const handleWeekendAccept = () => {
      const candidates = items.filter(i => 
          i.status === 'active' && 
          (i.subCategory || '').toLowerCase().includes('strumpfhose')
      );
      if (candidates.length === 0) {
          if (showToast) showToast("Keine passenden Items gefunden.", "warning");
          return;
      }

      const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
      setSuggestedItem(randomItem);
  };

  const handleStartSuggestion = async () => {
      if (!suggestedItem) return;
      try {
          await startSessionService(currentUser.uid, {
              itemId: suggestedItem.id,
              items: [suggestedItem],
              type: 'voluntary', 
              startedViaSuggestion: true
          });
          onClose();
          if (showToast) showToast("Viel Spaß.", "success");
      } catch (e) {
          console.error("Start suggestion error:", e);
          if (showToast) showToast("Fehler beim Starten.", "error");
      }
  };
  
  useEffect(() => {
      if (oathProgress >= 100 && viewState === 'oath' && !instruction.isAccepted) {
          handleCommitment(); 
      }
  }, [oathProgress, viewState]);

  const dialogPaperStyle = DESIGN_TOKENS.dialog?.paper?.sx || { borderRadius: '28px', bgcolor: '#1e1e1e' };

  const renderOathPhase = () => {
      const originalDuration = instruction.durationMinutes || 0;
      const currentDuration = originalDuration - creditReduction;
      
      const projectedBalanceNc = credits.nc - projectedCost.nc;
      const projectedBalanceLc = credits.lc - projectedCost.lc;
      const isInsolvencyRisk = (creditType === 'both' || creditType === 'nylon' ? projectedBalanceNc < -2880 : false) || 
                               (creditType === 'both' || creditType === 'lingerie' ? projectedBalanceLc < -2880 : false);

      const currentBalanceForColor = creditType === 'both' ? Math.min(credits.nc, credits.lc) : (creditType === 'nylon' ? credits.nc : credits.lc);
      const getChipLabel = () => {
          if (creditType === 'both') return `NC: ${credits.nc} | LC: ${credits.lc}`;
          return `${creditType === 'nylon' ? 'NC' : 'LC'}: ${creditType === 'nylon' ? credits.nc : credits.lc} min`;
      };

      const formatTime = (mins) => {
          if (mins <= 0) return "0m";
          const h = Math.floor(mins / 60);
          const m = Math.floor(mins % 60);
          if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`;
          return `${m}m`;
      };

      return (
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
                    {isNightProtocol ? "NACHT PROTOKOLL" : "TAGES ANWEISUNG"}
                </Typography>
                
                <Box sx={{ my: 3 }}>
                    <Box sx={{ width: 120, height: 120, borderRadius: '50%', border: `2px dashed ${PALETTE.primary.main}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <LockIcon sx={{ fontSize: 40, color: PALETTE.primary.main }} />
                    </Box>
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>BLIND OATH</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Akzeptiere die Anweisung, bevor du den Inhalt siehst. <br/>
                    Verpflichtung ist absolut.
                </Typography>
                
                <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        {isNightProtocol ? "ZEITRAUM" : "ZIEL DAUER"}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="h4" sx={{ color: creditReduction > 0 ? PALETTE.accents.green : '#fff', fontWeight: 'bold' }}>
                            {isNightProtocol ? "ÜBER NACHT" : formatTime(currentDuration)}
                        </Typography>
                        
                        {isNightProtocol && creditReduction > 0 && (
                            <Typography variant="caption" sx={{ color: PALETTE.accents.green }}>
                                (-{formatTime(creditReduction)})
                            </Typography>
                        )}

                        {!isNightProtocol && creditReduction > 0 && (
                            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                {formatTime(originalDuration)}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {showVault && (
                    <Box sx={{ 
                        mb: 3, px: 2, py: 2, 
                        border: `1px solid ${isOverdraft ? PALETTE.accents.red : PALETTE.accents.gold}`, 
                        borderRadius: 2, 
                        bgcolor: isOverdraft ? 'rgba(255, 0, 0, 0.05)' : 'rgba(255, 215, 0, 0.05)' 
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {isOverdraft ? <TrendingDownIcon sx={{ color: PALETTE.accents.red }} /> : <SavingsIcon sx={{ color: PALETTE.accents.gold }} />}
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: isOverdraft ? PALETTE.accents.red : PALETTE.accents.gold }}>
                                    {isOverdraft ? "DEBT WARNING" : "THE VAULT"}
                                </Typography>
                            </Box>
                            <Chip 
                                label={getChipLabel()} 
                                size="small" 
                                sx={{ 
                                    bgcolor: currentBalanceForColor < 0 ? PALETTE.accents.red : PALETTE.accents.gold, 
                                    color: '#000', fontWeight: 'bold', fontSize: '0.7rem' 
                                }} 
                            />
                        </Box>

                        {insolvencyData.isBlocked ? (
                             <Alert severity="error" sx={{ mb: 1, bgcolor: 'rgba(255,0,0,0.1)', color: '#ffaaaa' }}>
                                 INSOLVENZ. KREDIT GESPERRT.
                             </Alert>
                        ) : (
                            <>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'left' }}>
                                    Verkürzen (Max 33%): {isOverdraft && <span style={{color: PALETTE.accents.red}}>+50% STRAFE</span>}
                                </Typography>
                                <Box sx={{ px: 1 }}>
                                    <Slider
                                        value={creditReduction}
                                        min={0}
                                        max={maxReduction}
                                        step={15} 
                                        onChange={(e, val) => setCreditReduction(val)}
                                        sx={{ 
                                            color: isOverdraft ? PALETTE.accents.red : PALETTE.accents.gold,
                                            '& .MuiSlider-thumb': { boxShadow: isOverdraft ? '0 0 10px rgba(255,0,0,0.5)' : '0 0 10px rgba(255,215,0,0.5)' } 
                                        }}
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">0 min</Typography>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 'bold', display: 'block' }}>
                                            Reduktion: -{creditReduction} min
                                        </Typography>
                                        {creditReduction > 0 && (
                                            <Typography variant="caption" sx={{ color: isOverdraft ? PALETTE.accents.red : 'text.secondary' }}>
                                                Kosten: {creditType === 'both' 
                                                    ? `${projectedCost.nc} NC + ${projectedCost.lc} LC` 
                                                    : `${creditType === 'nylon' ? projectedCost.nc + ' NC' : projectedCost.lc + ' LC'}`}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                {isInsolvencyRisk && (
                                    <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block', fontWeight: 'bold' }}>
                                        LIMIT ÜBERSCHRITTEN! ({creditType === 'both' ? `NC: ${projectedBalanceNc}, LC: ${projectedBalanceLc}` : `${creditType === 'nylon' ? projectedBalanceNc : projectedBalanceLc} min`})
                                    </Typography>
                                )}
                            </>
                        )}
                    </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        <Button fullWidth variant="contained" size="large"
                            disabled={isInsolvencyRisk}
                            onMouseDown={onStartOath} onMouseUp={onCancelOath} onMouseLeave={onCancelOath} onTouchStart={onStartOath} onTouchEnd={onCancelOath}
                            sx={{ py: 2, bgcolor: isHoldingOath ? PALETTE.primary.dark : PALETTE.primary.main, overflow: 'hidden' }}>
                            {isHoldingOath ? "HALTEN..." : (creditReduction > 0 ? (isOverdraft ? "KREDIT AUFNEHMEN" : "KAUFEN & AKZEPTIEREN") : "AKZEPTIEREN")}
                            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${oathProgress}%`, bgcolor: 'rgba(255,255,255,0.2)', transition: 'width 0.05s linear' }} />
                        </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ReportProblemIcon fontSize="small" color="warning" /> Entscheidung ist final.
                    </Typography>
                    <Button color="error" onClick={onDeclineOath}>Ablehnen (Strafe)</Button>
                </Box>
            </Box>
      );
  };

  const renderPreparationPhase = () => {
      // Items mappen, fehlende Daten anreichern und strikt nach orderIndex sortieren
      const displayItems = (instruction?.items || [])
          .map(instrItem => {
              const foundItem = items.find(i => i.id === instrItem.id);
              return foundItem ? { ...foundItem, orderIndex: instrItem.orderIndex } : instrItem;
          })
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
          
      const primaryTransitItem = instruction?.transitProtocol?.active ? items.find(i => i.id === instruction.transitProtocol.primaryItemId) : null;

      const itemsSelectedCount = verifiedItemIds.length;
      const totalRequired = (instruction?.items || []).length;
      const isColdFeetAllowed = itemsSelectedCount > 0 && itemsSelectedCount < totalRequired;

      return (
        <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                 <Typography variant="overline" color="primary" sx={{ letterSpacing: 2 }}>UMKLEIDE (STAGING)</Typography>
                 <Chip icon={<TimerIcon />} label={timeLeftStr} color="warning" variant="outlined" size="small" />
            </Box>

            {instruction?.transitProtocol?.active && (
                <Box sx={{ mb: 3, p: 2, border: `1px solid ${PALETTE.accents.red}`, borderRadius: 2, bgcolor: 'rgba(255,0,0,0.05)', textAlign: 'left' }}>
                    <Typography variant="caption" color="error" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <TimerIcon fontSize="small"/> TRANSIT PROTOKOLL (30 MIN)
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">Innerhalb der Frist:</Typography>
                            <Typography variant="body2" sx={{ color: PALETTE.accents.green, fontWeight: 'bold' }}>{primaryTransitItem?.name || instruction.transitProtocol.primaryItem?.name || "Nacht-Höschen"}</Typography>
                        </Box>
                    </Box>
                    <Divider sx={{ my: 1.5, borderColor: 'rgba(255,0,0,0.2)' }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="caption" color="error" display="block" sx={{ fontWeight: 'bold' }}>Nach Ablauf (Strafe):</Typography>
                            <Typography variant="body2" sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>{instruction.transitProtocol.backupItem?.name}</Typography>
                            <Typography variant="caption" sx={{ color: '#fff', bgcolor: PALETTE.accents.red, px: 0.5, py: 0.2, borderRadius: 1, fontWeight: 'bold', display: 'inline-block', mt: 0.5 }}>ZWANGSENTLADUNG</Typography>
                        </Box>
                        {instruction.transitProtocol.backupItem?.img && <Avatar src={instruction.transitProtocol.backupItem.img} sx={{ width: 40, height: 40, border: `1px solid ${PALETTE.accents.red}` }} />}
                    </Box>
                </Box>
            )}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, my: 3 }}>
                {displayItems.map((displayItem, idx) => {
                    const isTransitBackup = instruction.transitProtocol?.active && instruction.transitProtocol?.backupItem?.id === displayItem.id;
                    const isVerified = verifiedItemIds.includes(displayItem.id);
                    
                    return (
                    <Box key={idx} sx={{ 
                        textAlign: 'center', flex: '1 1 140px', maxWidth: 160, position: 'relative',
                        border: isTransitBackup ? `1px dashed ${PALETTE.accents.red}` : 'none',
                        borderRadius: 2,
                        p: isTransitBackup ? 1 : 0,
                        opacity: isTransitBackup ? 0.7 : 1
                    }}>
                        {/* Overlay für verifizierte Items */}
                        {isVerified && (
                             <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 2 }}>
                                 <CheckCircleIcon sx={{ fontSize: 70, color: PALETTE.accents.green }} />
                             </Box>
                        )}

                        {displayItem.img || displayItem.imageUrl ? (
                            <Avatar src={displayItem.img || displayItem.imageUrl} sx={{ width: 100, height: 100, border: `2px solid ${isTransitBackup ? PALETTE.accents.red : PALETTE.primary.main}`, mx: 'auto', mb: 1, boxShadow: '0 0 15px rgba(0,0,0,0.5)' }} />
                        ) : (
                            <Box sx={{ width: 100, height: 100, borderRadius: '50%', border: `2px solid ${isTransitBackup ? PALETTE.accents.red : PALETTE.primary.main}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1, bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <AccessibilityNewIcon sx={{ fontSize: 40, color: isTransitBackup ? PALETTE.accents.red : 'inherit' }} />
                            </Box>
                        )}
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', lineHeight: 1.2, color: isTransitBackup ? PALETTE.accents.red : 'inherit' }}>
                            {displayItem.orderIndex ? `${displayItem.orderIndex}. ` : ''}{displayItem.name || displayItem.brand}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{displayItem.subCategory} {displayItem.color ? `• ${displayItem.color}` : ''}</Typography>
                        
                        <Chip 
                            icon={<FingerprintIcon />} 
                            label={displayItem.customId || displayItem.id?.substring(0,6)} 
                            size="small" 
                            variant="outlined"
                            sx={{ mb: 1, borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', fontSize: '0.65rem', height: 20 }} 
                        />
                        
                         {!isVerified && (
                             <Button size="small" variant="contained" onClick={() => handleVerifyItem(displayItem)} sx={{ mx: 'auto', display: 'block', fontSize: '0.6rem', bgcolor: PALETTE.primary.dark }}>
                                 MANUELL ANZIEHEN
                             </Button>
                         )}

                         {isTransitBackup && (
                             <Typography variant="caption" sx={{ color: PALETTE.accents.red, display: 'block', mt: 0.5, fontWeight: 'bold', fontSize: '0.6rem' }}>ERSATZ (STRAFE)</Typography>
                         )}
                    </Box>
                )})}
            </Box>

            <Alert severity={stagingStatus === 'ready' ? "success" : "info"} sx={{ mb: 3, textAlign: 'left', bgcolor: stagingStatus === 'ready' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(2, 136, 209, 0.1)' }}>
                {stagingStatus === 'ready' ? "Outfit komplett. Zeitmessung für Ziel gestartet." : `Ziehe alle Items an. Fortschritt: ${itemsSelectedCount}/${totalRequired}`}
            </Alert>

            {/* ACTION BUTTONS (STAGING) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                {stagingStatus !== 'ready' ? (
                    <Button fullWidth variant="outlined" size="large" onClick={activateNfcScan}
                            startIcon={<NfcIcon />}
                            disabled={isScanning}
                            sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.3)', color: 'text.primary' }}>
                            {isScanning ? "SCANNER LÄUFT..." : "ITEMS SCANNEN (NFC)"}
                    </Button>
                ) : (
                    <Button fullWidth variant="contained" size="large" onClick={onClose}
                            startIcon={<CheckCircleIcon />}
                            sx={{ ...DESIGN_TOKENS.buttonGradient, py: 1.5 }}>
                            Umkleide verlassen
                    </Button>
                )}
                
                {/* Die Falle für Kalte Füße */}
                {isColdFeetAllowed && (
                    <Button fullWidth variant="outlined" color="error" onClick={handleColdFeet} startIcon={<ReportProblemIcon />} sx={{ mt: 1 }}>
                        Abbrechen (Kalte Füße)
                    </Button>
                )}

                {stagingStatus !== 'ready' && <Button color="inherit" onClick={onClose} sx={{ mt: 1 }}>Später fortsetzen</Button>}
            </Box>
        </Box>
      );
  };

  const renderContent = () => {
    if (loadingStatus === 'loading') {
        return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}><CircularProgress color="primary" /></Box>;
    }
    
    if (!instruction) {
        if (isFreeDay) {
            const activeVoluntarySession = activeSessions.find(s => s.type === 'voluntary' && !s.endTime);
            let activeVoluntaryItem = null;
            if (activeVoluntarySession) {
                activeVoluntaryItem = items.find(i => i.id === activeVoluntarySession.itemId) || 
                                      (activeVoluntarySession.items && activeVoluntarySession.items[0]);
                
                if (!activeVoluntaryItem && activeVoluntarySession.itemIds && activeVoluntarySession.itemIds.length > 0) {
                     activeVoluntaryItem = items.find(i => activeVoluntarySession.itemIds.includes(i.id));
                }
            }
            
            const isWearingPantyhose = activeVoluntaryItem && 
                ((activeVoluntaryItem.subCategory || '').toLowerCase().includes('strumpfhose') || 
                 (activeVoluntaryItem.mainCategory || '').toLowerCase().includes('strumpfhose') ||
                 (activeVoluntaryItem.name || '').toLowerCase().includes('strumpfhose'));

            if (isWearingPantyhose) {
                return (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Box sx={{ mb: 2 }}>
                            {freeDayReason === 'Holiday' ? <CelebrationIcon sx={{ fontSize: 50, color: PALETTE.accents.gold }} /> : <WeekendIcon sx={{ fontSize: 50, color: PALETTE.accents.green }} />}
                        </Box>
                        <Typography variant="h6" gutterBottom>{freeDayReason === 'Holiday' ? 'Feiertag' : 'Wochenende'}</Typography>
                        
                        <Avatar src={activeVoluntaryItem.imageUrl || activeVoluntaryItem.img || (activeVoluntaryItem.images && activeVoluntaryItem.images[0])} variant="rounded" sx={{ width: 150, height: 150, mx: 'auto', my: 3, border: `1px solid ${PALETTE.primary.main}`, boxShadow: '0 0 15px rgba(0,0,0,0.5)' }} />

                        <Typography variant="body1" color="text.secondary" sx={{ mt: 2, px: 2, fontStyle: 'italic' }}>
                            Gut, dass du bereits eine Strumpfhose trägst. Die Nylon-Hure kann wohl nicht mehr ohne geile Nylonstrumpfhosen leben.
                        </Typography>
                        
                        <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Button variant="contained" size="large" fullWidth onClick={onClose} sx={{ ...DESIGN_TOKENS.buttonGradient }}>
                                Ich bin eine Nylon-Fotze.
                            </Button>
                        </Box>
                    </Box>
                );
            }

            if (suggestedItem) {
                return (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="overline" color="primary" sx={{ letterSpacing: 2, display: 'block', mb: 2 }}>DEINE WAHL</Typography>
                        <Avatar src={suggestedItem.imageUrl || suggestedItem.image} variant="rounded" sx={{ width: 150, height: 150, mx: 'auto', mb: 3, border: `1px solid ${PALETTE.primary.main}` }} />
                        <Typography variant="h5" fontWeight="bold" gutterBottom>{suggestedItem.name || suggestedItem.brand}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{suggestedItem.customId} • {suggestedItem.subCategory}</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Button variant="contained" size="large" fullWidth onClick={handleStartSuggestion} startIcon={<AutoAwesomeIcon />} sx={{ ...DESIGN_TOKENS.buttonGradient }}>Anziehen & Genießen</Button>
                            <Button color="inherit" onClick={onClose}>Doch nicht (Schließen)</Button>
                        </Box>
                    </Box>
                );
            }
            return (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Box sx={{ mb: 2 }}>
                        {freeDayReason === 'Holiday' ? <CelebrationIcon sx={{ fontSize: 50, color: PALETTE.accents.gold }} /> : <WeekendIcon sx={{ fontSize: 50, color: PALETTE.accents.green }} />}
                    </Box>
                    <Typography variant="h6" gutterBottom>{freeDayReason === 'Holiday' ? 'Feiertag' : 'Wochenende'}</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 2, px: 2, fontStyle: 'italic' }}>Es ist zwar Wochenende, aber du stehst doch darauf, dir eine sexy, schwarze, glänzende Strumpfhose anzuziehen. Ich suche dir gerne eine raus.</Typography>
                    <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button variant="outlined" color="primary" fullWidth onClick={handleWeekendAccept} startIcon={<AutoAwesomeIcon />}>Ja, bitte</Button>
                        <Button color="inherit" onClick={onClose}>Nein, danke</Button>
                    </Box>
                </Box>
            );
        }
        return (
            <Box sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                   {isNight ? <NightlightRoundIcon sx={{ color: PALETTE.accents.purple, fontSize: 30 }} /> : <WbSunnyIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />}
                </Box>
                <Typography variant="h6" sx={{ mb: 3 }}>Keine Anweisung</Typography>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button color="inherit" onClick={onClose} fullWidth>Schließen</Button>
                </Box>
            </Box>
        );
    }

    if (viewState === 'preparation' || instruction.isAccepted) {
        return renderPreparationPhase();
    } else {
        return renderOathPhase();
    }
  };

  const canClose = (!instruction && !suggestedItem) || instruction?.isAccepted || (isFreeDay && suggestedItem);

  return (
    <>
      <Dialog 
          open={open} 
          onClose={canClose ? onClose : undefined} 
          disableEscapeKeyDown={!canClose}
          maxWidth="xs" fullWidth 
          PaperProps={{ sx: dialogPaperStyle }}
      >
        <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ duration: 0.3 }}
                key={viewState} 
            >
                {renderContent()}
            </motion.div>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={hardcoreDialogOpen} 
        disableEscapeKeyDown 
        PaperProps={{ sx: { ...dialogPaperStyle, border: `1px solid ${PALETTE.accents.red}` } }}
      >
          <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.red }}>
              <ReportProblemIcon /> Hardcore Protokoll
          </DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                      <DialogContentText sx={{ color: 'text.primary', mb: 2 }}>
                          <strong>Eine sofortige Entladung wird gefordert.</strong>
                      </DialogContentText>
                      
                      {releaseMethod && (
                        <Box sx={{ 
                            p: 2, 
                            bgcolor: 'rgba(255, 0, 0, 0.1)', 
                            border: `1px solid ${PALETTE.accents.red}`,
                            borderRadius: '8px'
                        }}>
                            <Typography variant="caption" color="error" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                Vorgeschriebene Methode
                            </Typography>
                            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mt: 1 }}>
                                {releaseMethod}
                            </Typography>
                        </Box>
                      )}
                  </Box>
              </motion.div>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button fullWidth variant="contained" color="error" onClick={handleHardcoreAccept}>Akzeptieren</Button>
              <Button fullWidth variant="outlined" color="warning" onClick={handleHardcoreRefuse}>Verweigern (Strafe)</Button>
          </DialogActions>
      </Dialog>
    </>
  );
}