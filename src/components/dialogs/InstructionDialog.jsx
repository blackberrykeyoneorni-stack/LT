import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText,
  Typography, Box, Button, CircularProgress, Avatar,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText, IconButton,
  Slider, Chip, Divider
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
import SavingsIcon from '@mui/icons-material/Savings'; // Icon für TimeBank

import { useNFCGlobal } from '../../contexts/NFCContext';
import { useAuth } from '../../contexts/AuthContext';
import { startSession as startSessionService } from '../../services/SessionService';
import { registerPunishment } from '../../services/PunishmentService';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getTimeBankBalance, spendCredits } from '../../services/TimeBankService';

export default function InstructionDialog({ 
  open, onClose, instruction, items, loadingStatus,
  isNight, isFreeDay, freeDayReason,
  onStartOath, onCancelOath, onDeclineOath, 
  onStartRequest, onNavigateItem,
  oathProgress, isHoldingOath, showToast 
}) {
  const { startBindingScan, isScanning } = useNFCGlobal();
  const { currentUser } = useAuth();
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [suggestedItem, setSuggestedItem] = useState(null);
  const [hardcoreDialogOpen, setHardcoreDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [hcPrefs, setHcPrefs] = useState({ enabled: false, probability: 15 });
  const [releaseMethod, setReleaseMethod] = useState(null);

  // --- TIME BANK STATE ---
  const [credits, setCredits] = useState({ nc: 0, lc: 0 });
  const [creditReduction, setCreditReduction] = useState(0); // Minuten, die abgezogen werden
  const [maxReduction, setMaxReduction] = useState(0); // Cap (1/3 oder Balance)
  const [creditType, setCreditType] = useState(null); // 'nylon' oder 'lingerie'

  useEffect(() => {
    const loadData = async () => {
        if (!currentUser || !open) return;
        
        // 1. Prefs laden (Hardcore)
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

        // 2. TimeBank laden (wenn Instruction vorhanden und nicht akzeptiert)
        if (instruction && !instruction.isAccepted) {
            const balance = await getTimeBankBalance(currentUser.uid);
            setCredits(balance);
            setCreditReduction(0); // Reset bei neuem Dialog
            
            // Ermittle Item Typ
            let type = 'lingerie';
            if (instruction.items && instruction.items.length > 0) {
                // Wir nehmen das erste Item als Referenz (oder das "härteste")
                // Da wir instruction.items meistens nur als {id, name, img} haben, suchen wir im vollen 'items' Array
                const fullItem = items.find(i => i.id === instruction.items[0].id);
                if (fullItem) {
                    const sub = (fullItem.subCategory || '').toLowerCase();
                    const cat = (fullItem.mainCategory || '').toLowerCase();
                    if (sub.includes('strumpfhose') || sub.includes('tights') || 
                        sub.includes('halterlose') || sub.includes('stockings') || 
                        cat.includes('nylons')) {
                        type = 'nylon';
                    }
                }
            }
            setCreditType(type);
        }
    };
    loadData();
  }, [currentUser, open, instruction, items]);

  useEffect(() => {
      if (open) setSuggestedItem(null);
  }, [open]);

  // --- TIME BANK LOGIC ---
  // Prüfen ob Einlösung erlaubt ist
  const canSpendCredits = 
      instruction && 
      !instruction.isAccepted && 
      instruction.periodId && instruction.periodId.includes('day') && // NUR TAG
      credits && creditType &&
      (creditType === 'nylon' ? credits.nc > 0 : credits.lc > 0);

  // Berechne Limit (1/3 Regel)
  useEffect(() => {
      if (canSpendCredits && instruction.durationMinutes) {
          const limitByPolicy = Math.floor(instruction.durationMinutes / 3); // Max 33%
          const available = creditType === 'nylon' ? credits.nc : credits.lc;
          
          // Das Limit ist das Kleinere von beiden (Politik oder Geldbeutel)
          const actualMax = Math.min(limitByPolicy, available);
          setMaxReduction(actualMax);
      } else {
          setMaxReduction(0);
      }
  }, [canSpendCredits, instruction, credits, creditType]);


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
      } catch (e) { console.error(e); } finally {
          setHardcoreDialogOpen(false);
          if (pendingAction) pendingAction();
          setPendingAction(null);
      }
  };

  const handleHardcoreAccept = () => {
      if (showToast) showToast("Brav. Session wird gestartet.", "success");
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

  const handleVerifyItem = (fullItem) => {
      if (!fullItem) return;
      const executeVerify = () => {
        startBindingScan(async (scannedTagId) => {
            const isMatch = (scannedTagId === fullItem.nfcTagId || scannedTagId === fullItem.customId || scannedTagId === fullItem.id);
            if (isMatch) {
                try {
                    await startSessionService(currentUser.uid, {
                        itemId: fullItem.id, items: [fullItem], type: 'instruction', 
                        periodId: instruction.periodId, acceptedAt: instruction.acceptedAt, verifiedViaNfc: true,
                        // Hier übergeben wir die reduzierte Dauer (falls Credit genutzt wurde)
                        // Achtung: Credits wurden schon beim "Schwur" abgezogen.
                        // Hier geht es nur noch um die Session-Metadaten.
                        instructionDurationMinutes: instruction.durationMinutes // Dies ist nun schon der reduzierte Wert aus dem State
                    });
                    setVerifiedItems(prev => [...prev, fullItem.id]);
                    if (showToast) showToast(`${fullItem.name} verifiziert!`, "success");
                    if (navigator.vibrate) navigator.vibrate(200);
                } catch (e) { if (showToast) showToast("Fehler beim Start.", "error"); }
            } else { if (showToast) showToast("Falscher Tag!", "error"); }
        });
      };
      triggerHardcoreCheck(executeVerify);
  };

  const handleSmartStart = () => {
      const executeStart = () => {
        const unverifiedItems = instruction.items.filter(i => !verifiedItems.includes(i.id));
        if (unverifiedItems.length === 0) { onClose(); if (showToast) showToast("Erledigt.", "success"); } 
        else { onStartRequest(unverifiedItems); }
      };
      triggerHardcoreCheck(executeStart);
  };

  // --- OATH WRAPPER FOR SPENDING ---
  const handleOathComplete = async () => {
      // 1. Credits abziehen (wenn genutzt)
      if (creditReduction > 0) {
          await spendCredits(currentUser.uid, creditReduction, creditType);
          if (showToast) showToast(`${creditReduction} Minuten Guthaben eingelöst.`, "info");
      }

      // 2. Oath Logik aufrufen (Parent)
      // Wir müssen dem Parent/InstructionService eigentlich mitteilen, dass die Dauer verkürzt wurde.
      // Da 'handleAcceptOath' im Dashboard liegt und nur das Flag setzt, 
      // updaten wir die Instruction lokal, damit beim Starten die richtige Zeit genutzt wird.
      
      // ACHTUNG: Das saubere Vorgehen wäre, die reduzierte Zeit auch in 'dailyInstruction' zu speichern.
      // Aber für den Session-Start reicht es, wenn wir es hier wissen.
      
      // Wir rufen onStartOath auf? Nein, dies ist der Callback wenn der Timer fertig ist.
      // Der Timer im Dialog ruft 'handleAcceptOath' im Dashboard auf.
      // Wir müssen diesen Flow leicht anpassen oder hier hooken.
      
      // Workaround: Wir manipulieren die 'instruction' im lokalen Scope nicht permanent,
      // aber wir updaten die Datenbank optional mit der neuen Zielzeit.
      
      // Da wir keine Prop für 'updateInstruction' haben, rufen wir onStartOath/onCancel nicht hier auf,
      // sondern wir sind der "Trigger", wenn der Button losgelassen wird (bei 100%).
      // Das wird via 'oathProgress' gesteuert.
      // Die Logik liegt im Dashboard.jsx 'handleAcceptOath'.
      
      // Da wir im Dashboard keinen Zugriff auf 'creditReduction' haben, müssen wir das Spending HIER machen,
      // BEVOR wir dem Dashboard sagen "Ist akzeptiert".
      
      // Problem: Der Button im Dashboard triggert den Timer.
      // Lösung: Wir lassen den Timer laufen. Wenn er fertig ist, ruft er im Dashboard 'handleAcceptOath' auf.
      // Das Dashboard weiß nichts von den Credits.
      // Das ist okay. Das Spending passiert HIER beim Klick auf "Akzeptieren"? Nein, beim Halten.
      
      // BESSERE LÖSUNG: Wir nutzen onStartOath nur als Trigger.
      // Wenn der User den OathButton drückt (MouseDown), passiert nichts Kritisches.
      // Wenn der Balken voll ist, wird die Funktion im Dashboard gerufen.
      
      // Wir injizieren die Credit-Logik in den Props-Callback? Nein, React Props sind read-only.
      
      // Pragmatisch: Wir machen das Spending, wenn der User den Slider bewegt? Nein. Erst beim Kauf.
      // Wir führen das Spending aus, wenn der Dialog schließt? Nein.
      
      // Wir müssen 'handleAcceptOath' im Dashboard wrappen. Aber wir sind hier im Child.
      // Wir können es nicht.
      
      // Alternative: Wir führen das Spending aus, wenn `instruction.isAccepted` true wird!
      // Das passiert als Reaktion auf das Dashboard-Update.
  };

  // Wir überwachen, ob die Instruction akzeptiert wurde.
  // Wenn ja, und wir hatten eine Reduction eingestellt -> SPEND!
  // Und wir speichern die neue Dauer in der DB.
  useEffect(() => {
      if (instruction?.isAccepted && creditReduction > 0) {
          const finalizeSpending = async () => {
             // Verhindern von Double-Spending via lokaler Ref wäre gut, aber Instruction ändert sich eh.
             await spendCredits(currentUser.uid, creditReduction, creditType);
             
             // Update der Instruction Duration in der DB, damit die Session das korrekte Ziel hat
             const newDuration = (instruction.durationMinutes || 0) - creditReduction;
             await updateDoc(doc(db, `users/${currentUser.uid}/status/dailyInstruction`), {
                 durationMinutes: newDuration,
                 originalDurationMinutes: instruction.durationMinutes, // Audit Trail
                 creditsUsed: creditReduction
             });
             
             // Lokales Reset
             setCreditReduction(0);
          };
          finalizeSpending();
      }
  }, [instruction?.isAccepted]); // Trigger wenn accepted wahr wird


  const totalItems = instruction?.items?.length || 0;
  const verifiedCount = verifiedItems.length;
  const remainingCount = totalItems - verifiedCount;
  const allDone = totalItems > 0 && remainingCount === 0;
  const dialogPaperStyle = DESIGN_TOKENS.dialog?.paper?.sx || { borderRadius: '28px', bgcolor: '#1e1e1e' };

  const renderContent = () => {
    if (loadingStatus === 'loading') {
        return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}><CircularProgress color="primary" /></Box>;
    }
    
    if (!instruction) {
        if (isFreeDay) {
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
                <Typography variant="h6">Keine Anweisung</Typography>
            </Box>
        );
    }

    if (!instruction.isAccepted) {
        const originalDuration = instruction.durationMinutes || 0;
        const currentDuration = originalDuration - creditReduction;

        return (
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>{isNight ? "NACHT PROTOKOLL" : "TAGES ANWEISUNG"}</Typography>
                <Box sx={{ my: 3 }}>
                    {instruction.itemImage ? (
                        <Avatar src={instruction.itemImage} sx={{ width: 120, height: 120, border: `2px solid ${PALETTE.primary.main}`, mx: 'auto' }} />
                    ) : (
                        <Box sx={{ width: 120, height: 120, borderRadius: '50%', border: `2px dashed ${PALETTE.primary.main}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', bgcolor: 'rgba(0,0,0,0.3)' }}><LockIcon sx={{ fontSize: 40, color: PALETTE.primary.main }} /></Box>
                    )}
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>{instruction.itemName || "Instruction"}</Typography>
                
                {/* DURATION DISPLAY */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">ZIEL DAUER</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="h4" sx={{ color: creditReduction > 0 ? PALETTE.accents.green : '#fff', fontWeight: 'bold' }}>
                            {Math.round(currentDuration / 60)}h {(currentDuration % 60) > 0 ? `${currentDuration % 60}m` : ''}
                        </Typography>
                        {creditReduction > 0 && (
                            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                {Math.round(originalDuration / 60)}h
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* THE VAULT (TIME BANK) */}
                {canSpendCredits && (
                    <Box sx={{ mb: 3, px: 2, py: 2, border: `1px solid ${PALETTE.accents.gold}`, borderRadius: 2, bgcolor: 'rgba(255, 215, 0, 0.05)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SavingsIcon sx={{ color: PALETTE.accents.gold }} fontSize="small" />
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: PALETTE.accents.gold }}>THE VAULT</Typography>
                            </Box>
                            <Chip 
                                label={`${creditType === 'nylon' ? 'NC' : 'LC'}: ${creditType === 'nylon' ? credits.nc : credits.lc} min`} 
                                size="small" 
                                sx={{ bgcolor: PALETTE.accents.gold, color: '#000', fontWeight: 'bold', fontSize: '0.7rem' }} 
                            />
                        </Box>
                        
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'left' }}>
                            Guthaben einlösen (Max 33%):
                        </Typography>
                        <Box sx={{ px: 1 }}>
                            <Slider
                                value={creditReduction}
                                min={0}
                                max={maxReduction}
                                step={15} // 15 Min Schritte
                                onChange={(e, val) => setCreditReduction(val)}
                                sx={{ 
                                    color: PALETTE.accents.gold,
                                    '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(255,215,0,0.5)' } 
                                }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">0 min</Typography>
                            <Typography variant="caption" sx={{ color: creditReduction > 0 ? PALETTE.accents.green : 'text.secondary', fontWeight: 'bold' }}>
                                -{creditReduction} min
                            </Typography>
                        </Box>
                    </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        <Button fullWidth variant="contained" size="large"
                            onMouseDown={onStartOath} onMouseUp={onCancelOath} onMouseLeave={onCancelOath} onTouchStart={onStartOath} onTouchEnd={onCancelOath}
                            sx={{ py: 2, bgcolor: isHoldingOath ? PALETTE.primary.dark : PALETTE.primary.main, overflow: 'hidden' }}>
                            {isHoldingOath ? "HALTEN..." : (creditReduction > 0 ? "KAUFEN & AKZEPTIEREN" : "AKZEPTIEREN")}
                            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${oathProgress}%`, bgcolor: 'rgba(255,255,255,0.2)', transition: 'width 0.05s linear' }} />
                        </Button>
                    </Box>
                    <Button color="error" onClick={onDeclineOath}>Ablehnen (Strafe)</Button>
                </Box>
            </Box>
        );
    }
    
    if (instruction.isAccepted) {
        return (
            <List>
                {instruction.items.map(instrItem => {
                    const fullItem = items.find(i => i.id === instrItem.id);
                    const displayName = fullItem?.name || instrItem.name || "Item";
                    const isVerified = verifiedItems.includes(instrItem.id);
                    return (
                        <ListItem key={instrItem.id} disablePadding divider secondaryAction={
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <IconButton edge="end" color={isVerified ? "success" : "primary"} onClick={() => !isVerified && handleVerifyItem(fullItem)} disabled={isScanning || isVerified}>
                                        {isVerified ? <CheckCircleIcon /> : <NfcIcon />}
                                    </IconButton>
                                    <IconButton edge="end" onClick={() => { onClose(); onNavigateItem(instrItem.id); }}><LaunchIcon /></IconButton>
                                </Box>
                            }>
                             <ListItemButton onClick={() => { onClose(); onNavigateItem(instrItem.id); }} sx={{ pr: 9 }}>
                                <ListItemAvatar><Avatar variant="rounded" src={fullItem?.imageUrl || instrItem.img} /></ListItemAvatar>
                                <ListItemText primary={displayName} secondary={fullItem?.customId} 
                                    primaryTypographyProps={{ sx: { textDecoration: isVerified ? 'line-through' : 'none', opacity: isVerified ? 0.7 : 1 } }} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        );
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
            >
                {renderContent()}
            </motion.div>
        </DialogContent>
        
        {canClose && (
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                {instruction?.isAccepted && (
                    <Button variant="contained" fullWidth onClick={handleSmartStart} color={allDone ? "success" : "primary"} sx={{ mb: 1, py: 1.5 }}>
                        {allDone ? "Fertig" : (verifiedCount > 0 ? `Rest (${remainingCount})` : "Alle Starten")}
                    </Button>
                )}
                <Button onClick={onClose} fullWidth color="inherit">Schließen</Button>
            </DialogActions>
        )}
      </Dialog>

      {/* HARDCORE DIALOG */}
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