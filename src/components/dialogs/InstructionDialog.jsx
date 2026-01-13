import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText,
  Typography, Box, Button, CircularProgress, Avatar,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText, IconButton
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign'; // NEU
import LockIcon from '@mui/icons-material/Lock';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LaunchIcon from '@mui/icons-material/Launch';
import LabelIcon from '@mui/icons-material/Label';
import WeekendIcon from '@mui/icons-material/Weekend';
import CelebrationIcon from '@mui/icons-material/Celebration';
import NfcIcon from '@mui/icons-material/Nfc';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import { useNFCGlobal } from '../../contexts/NFCContext';
import { useAuth } from '../../contexts/AuthContext';
import { startSession as startSessionService } from '../../services/SessionService';
import { registerPunishment } from '../../services/PunishmentService';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

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
  
  // Hardcore Logic
  const [hardcoreDialogOpen, setHardcoreDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [hcPrefs, setHcPrefs] = useState({ enabled: false, probability: 15 });

  useEffect(() => {
    const loadPrefs = async () => {
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
    };
    loadPrefs();
  }, [currentUser, open]);

  const triggerHardcoreCheck = (actionToExecute) => {
      if (!isNight || !hcPrefs.enabled) { actionToExecute(); return; }
      const roll = Math.random();
      const threshold = hcPrefs.probability / 100;
      if (roll < threshold) {
          setPendingAction(() => actionToExecute);
          setHardcoreDialogOpen(true);
      } else { actionToExecute(); }
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

  const handleVerifyItem = (fullItem) => {
      if (!fullItem) return;
      const executeVerify = () => {
        startBindingScan(async (scannedTagId) => {
            const isMatch = (scannedTagId === fullItem.nfcTagId || scannedTagId === fullItem.customId || scannedTagId === fullItem.id);
            if (isMatch) {
                try {
                    await startSessionService(currentUser.uid, {
                        itemId: fullItem.id, items: [fullItem], type: 'instruction', 
                        periodId: instruction.periodId, acceptedAt: instruction.acceptedAt, verifiedViaNfc: true
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

  const totalItems = instruction?.items?.length || 0;
  const verifiedCount = verifiedItems.length;
  const remainingCount = totalItems - verifiedCount;
  const allDone = totalItems > 0 && remainingCount === 0;

  const renderContent = () => {
    if (loadingStatus === 'loading') {
        return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}><CircularProgress color="primary" /></Box>;
    }
    if (!instruction) {
        return (
            <Box sx={{ textAlign: 'center', py: 3 }}>
                {isFreeDay ? (
                    <>
                        <Box sx={{ mb: 2 }}>{freeDayReason === 'Holiday' ? <CelebrationIcon sx={{ fontSize: 50, color: PALETTE.accents.gold }} /> : <WeekendIcon sx={{ fontSize: 50, color: PALETTE.accents.green }} />}</Box>
                        <Typography variant="h6">{freeDayReason === 'Holiday' ? 'Feiertag' : 'Wochenende'}</Typography>
                    </>
                ) : (
                    <>
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                           {isNight ? <NightlightRoundIcon sx={{ color: PALETTE.accents.purple, fontSize: 30 }} /> : <WbSunnyIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />}
                        </Box>
                        <Typography variant="h6">Keine Anweisung</Typography>
                    </>
                )}
            </Box>
        );
    }
    if (!instruction.isAccepted) {
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        <Button fullWidth variant="contained" size="large"
                            onMouseDown={onStartOath} onMouseUp={onCancelOath} onMouseLeave={onCancelOath} onTouchStart={onStartOath} onTouchEnd={onCancelOath}
                            sx={{ py: 2, bgcolor: isHoldingOath ? PALETTE.primary.dark : PALETTE.primary.main, overflow: 'hidden' }}>
                            {isHoldingOath ? "HALTEN..." : "AKZEPTIEREN"}
                            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${oathProgress}%`, bgcolor: 'rgba(255,255,255,0.2)', transition: 'width 0.05s linear' }} />
                        </Button>
                    </Box>
                    <Button color="error" onClick={onDeclineOath}>Ablehnen (Strafe)</Button>
                </Box>
            </Box>
        );
    }
    // Accepted List
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

  return (
    <>
      <Dialog 
          open={open} 
          onClose={!instruction?.isAccepted ? onClose : undefined} 
          maxWidth="xs" fullWidth 
          PaperProps={DESIGN_TOKENS.dialog.paper} // ZENTRALISIERT
      >
        <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
          {renderContent()}
        </DialogContent>
        {(!instruction || instruction.isAccepted) && (
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

      {/* HARDCORE DIALOG - Ebenfalls zentralisiert */}
      <Dialog open={hardcoreDialogOpen} disableEscapeKeyDown PaperProps={{ ...DESIGN_TOKENS.dialog.paper, sx: { ...DESIGN_TOKENS.dialog.paper.sx, border: `1px solid ${PALETTE.accents.red}` } }}>
          <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.red }}>
              <ReportProblemIcon /> Hardcore Protokoll
          </DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <DialogContentText sx={{ color: 'text.primary' }}>
                  <strong>Eine sofortige Entladung wird gefordert.</strong>
              </DialogContentText>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button fullWidth variant="contained" color="error" onClick={handleHardcoreAccept}>Akzeptieren</Button>
              <Button fullWidth variant="outlined" color="warning" onClick={handleHardcoreRefuse}>Verweigern (Strafe)</Button>
          </DialogActions>
      </Dialog>
    </>
  );
}