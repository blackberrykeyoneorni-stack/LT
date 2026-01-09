import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogActions, 
  Typography, 
  Box, 
  Button, 
  CircularProgress,
  Avatar,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText,
  IconButton
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import LockIcon from '@mui/icons-material/Lock';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LaunchIcon from '@mui/icons-material/Launch';
import LabelIcon from '@mui/icons-material/Label';
import WeekendIcon from '@mui/icons-material/Weekend';
import CelebrationIcon from '@mui/icons-material/Celebration';
import NfcIcon from '@mui/icons-material/Nfc';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { useNFCGlobal } from '../../contexts/NFCContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function InstructionDialog({ 
  open, 
  onClose, 
  instruction, 
  items,
  loadingStatus, // 'loading', 'ready'
  isNight,
  isFreeDay,
  freeDayReason,
  onStartOath, 
  onCancelOath, 
  onDeclineOath, 
  onStartRequest, // Erwartet nun (itemsToStart)
  onNavigateItem,
  oathProgress,
  isHoldingOath,
  showToast // NEU: Für Feedback
}) {

  // Contexts
  const { startBindingScan, isScanning } = useNFCGlobal();
  const { currentUser } = useAuth();
  
  // Local State für verifizierte Items während der Dialog offen ist
  const [verifiedItems, setVerifiedItems] = useState([]);

  // --- NFC VERIFICATION LOGIC ---
  const handleVerifyItem = (fullItem) => {
      if (!fullItem) return;

      // Wir nutzen den Binding-Scanner, um die ID abzugreifen
      startBindingScan(async (scannedTagId) => {
          console.log("Verify Scan:", scannedTagId, "Target:", fullItem);

          // Prüfung: Stimmt der Tag mit irgendeiner ID des Items überein?
          // 1. nfcTagId (gespeicherter Tag)
          // 2. customId (manuelle ID)
          // 3. id (Firestore Doc ID)
          const isMatch = (
              scannedTagId === fullItem.nfcTagId || 
              scannedTagId === fullItem.customId ||
              scannedTagId === fullItem.id
          );

          if (isMatch) {
              // 1. Session starten
              try {
                  // FIX: Lag berechnen und Period hinzufügen, damit Dashboard dies als Instruction erkennt
                  let lagMinutes = 0;
                  if (instruction && instruction.acceptedAt) {
                        const acceptDate = new Date(instruction.acceptedAt);
                        const diffMs = Date.now() - acceptDate.getTime();
                        lagMinutes = Math.max(0, Math.floor(diffMs / 60000));
                  }

                  await addDoc(collection(db, `users/${currentUser.uid}/sessions`), {
                      itemId: fullItem.id, 
                      itemIds: [fullItem.id], 
                      type: 'instruction', // Markiert als Teil einer Anweisung
                      period: instruction.periodId, // WICHTIG: Verbindet Session mit Fortschrittsbalken
                      complianceLagMinutes: lagMinutes,
                      startTime: serverTimestamp(), 
                      endTime: null,
                      verifiedViaNfc: true
                  });
                  
                  // 2. UI Update
                  setVerifiedItems(prev => [...prev, fullItem.id]);
                  
                  if (showToast) showToast(`${fullItem.name} verifiziert & gestartet!`, "success");
                  
                  // Haptisches Feedback
                  if (navigator.vibrate) navigator.vibrate(200);

              } catch (e) {
                  console.error("Fehler beim Session-Start:", e);
                  if (showToast) showToast("Fehler beim Starten der Session.", "error");
              }
          } else {
              if (showToast) showToast(`Falscher Tag! Erwartet: ${fullItem.name}`, "error");
          }
      });
  };

  // --- SMART START HANDLER ---
  const handleSmartStart = () => {
      // Wir prüfen, welche Items aus der Instruction noch NICHT verifiziert (gestartet) wurden
      const unverifiedItems = instruction.items.filter(i => !verifiedItems.includes(i.id));
      
      if (unverifiedItems.length === 0) {
          // Alles erledigt -> Schließen
          onClose();
          if (showToast) showToast("Alle Anweisungen erfüllt.", "success");
      } else {
          // Restliche starten (Ohne NFC Zwang via Dashboard Handler)
          onStartRequest(unverifiedItems);
      }
  };

  // Status Berechnung für Button
  const totalItems = instruction?.items?.length || 0;
  const verifiedCount = verifiedItems.length;
  const remainingCount = totalItems - verifiedCount;
  const allDone = totalItems > 0 && remainingCount === 0;

  // CONTENT RENDERER
  const renderContent = () => {
    // 1. Loading State
    if (loadingStatus === 'loading') {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <CircularProgress color="primary" />
                <Typography sx={{ mt: 2, color: 'text.secondary' }}>Analysiere Protokoll...</Typography>
            </Box>
        );
    }

    // 2. Empty State (Keine Instruction generiert -> "Frei" oder "Keine Items")
    if (!instruction) {
        return (
            <Box sx={{ textAlign: 'center', py: 3 }}>
                {isFreeDay ? (
                    <>
                        <Box sx={{ mb: 2 }}>
                            {freeDayReason === 'Holiday' ? 
                                <CelebrationIcon sx={{ fontSize: 50, color: PALETTE.accents.gold }} /> : 
                                <WeekendIcon sx={{ fontSize: 50, color: PALETTE.accents.green }} />
                            }
                        </Box>
                        <Typography variant="h6" gutterBottom>{freeDayReason === 'Holiday' ? 'Feiertag' : 'Wochenende'}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Genieße deine freie Zeit.
                        </Typography>
                    </>
                ) : (
                    <>
                        <Box sx={{ 
                            bgcolor: 'rgba(255,255,255,0.05)', 
                            width: 60, height: 60, borderRadius: '50%', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            mx: 'auto', mb: 2 
                        }}>
                           {isNight ? <NightlightRoundIcon sx={{ color: PALETTE.accents.purple, fontSize: 30 }} /> : <WbSunnyIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />}
                        </Box>
                        <Typography variant="h6" gutterBottom>Keine Anweisung</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isNight 
                                ? "Für diese Nacht liegt keine spezifische Anweisung vor." 
                                : "Derzeit sind keine passenden Items verfügbar."}
                        </Typography>
                    </>
                )}
            </Box>
        );
    }

    // 3. OATH PHASE (Noch nicht akzeptiert)
    if (!instruction.isAccepted) {
        return (
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
                    {isNight ? "NACHT PROTOKOLL" : "TAGES ANWEISUNG"}
                </Typography>
                
                <Box sx={{ my: 3, position: 'relative', display: 'inline-block' }}>
                    {instruction.itemImage ? (
                        <Avatar 
                            src={instruction.itemImage} 
                            sx={{ width: 120, height: 120, border: `2px solid ${PALETTE.primary.main}`, mx: 'auto' }} 
                        />
                    ) : (
                        <Box sx={{ 
                            width: 120, height: 120, borderRadius: '50%', 
                            border: `2px dashed ${PALETTE.primary.main}`, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            mx: 'auto', bgcolor: 'rgba(0,0,0,0.3)'
                        }}>
                            <LockIcon sx={{ fontSize: 40, color: PALETTE.primary.main }} />
                        </Box>
                    )}
                </Box>

                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {instruction.itemName || (instruction.items && instruction.items[0]?.name) || "Unbekanntes Item"}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, px: 2 }}>
                    Bestätige die Annahme durch langes Drücken.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onMouseDown={onStartOath}
                            onMouseUp={onCancelOath}
                            onMouseLeave={onCancelOath}
                            onTouchStart={onStartOath}
                            onTouchEnd={onCancelOath}
                            sx={{ 
                                py: 2, 
                                bgcolor: isHoldingOath ? PALETTE.primary.dark : PALETTE.primary.main,
                                transition: 'background 0.2s',
                                overflow: 'hidden'
                            }}
                        >
                            {isHoldingOath ? "HALTEN..." : "AKZEPTIEREN"}
                            {/* Progress Fill Overlay */}
                            <Box sx={{ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, 
                                width: `${oathProgress}%`, 
                                bgcolor: 'rgba(255,255,255,0.2)', 
                                transition: 'width 0.05s linear' 
                            }} />
                        </Button>
                    </Box>
                    <Button color="error" onClick={onDeclineOath}>
                        Ablehnen (Strafe)
                    </Button>
                </Box>
            </Box>
        );
    }

    // 4. ITEM LIST (Akzeptiert -> Details anzeigen)
    if (instruction.isAccepted) {
        return (
            <List>
                {instruction.items.map(instrItem => {
                    // Volles Item-Objekt finden
                    const fullItem = items.find(i => i.id === instrItem.id);
                    
                    let displayName = fullItem?.name || instrItem.name || "Item";
                    if (fullItem?.brand && fullItem?.model) {
                       displayName = `${fullItem.brand} ${fullItem.model}`;
                    }
                    const displayId = fullItem?.customId || instrItem.id || "?";
                    const displaySub = fullItem?.subCategory || instrItem.subCategory || "Kategorie";
                    const displayImg = fullItem?.imageUrl || (fullItem?.images && fullItem.images[0]) || instrItem.img;

                    // Check if already verified
                    const isVerified = verifiedItems.includes(instrItem.id);

                    return (
                        <ListItem key={instrItem.id} disablePadding divider
                            secondaryAction={
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {/* NFC SCAN BUTTON */}
                                    <IconButton 
                                        edge="end" 
                                        color={isVerified ? "success" : "primary"}
                                        onClick={() => !isVerified && handleVerifyItem(fullItem)}
                                        disabled={isScanning || isVerified}
                                        sx={{ 
                                            border: isVerified ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                            bgcolor: isVerified ? 'rgba(0,255,0,0.1)' : 'transparent'
                                        }}
                                    >
                                        {isVerified ? <CheckCircleIcon /> : <NfcIcon />}
                                    </IconButton>
                                    
                                    {/* DETAIL NAV BUTTON */}
                                    <IconButton 
                                        edge="end" 
                                        color="default" 
                                        onClick={() => { onClose(); onNavigateItem(instrItem.id); }}
                                    >
                                        <LaunchIcon />
                                    </IconButton>
                                </Box>
                            }
                        >
                             <ListItemButton onClick={() => { onClose(); onNavigateItem(instrItem.id); }} sx={{ pr: 9 }}>
                                <ListItemAvatar>
                                    <Avatar variant="rounded" src={displayImg} alt={displayName} sx={{ width: 50, height: 50, mr: 2 }} />
                                </ListItemAvatar>
                                <ListItemText 
                                    primary={
                                        <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '1.1rem', textDecoration: isVerified ? 'line-through' : 'none', opacity: isVerified ? 0.7 : 1 }}>
                                            {displayName}
                                        </Typography>
                                    } 
                                    secondary={
                                        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 0.5 }}>
                                            <Typography component="span" variant="caption" sx={{ fontWeight: 'bold', color: PALETTE.accents.pink, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                 <LabelIcon style={{ fontSize: '0.9rem' }}/> {displayId}
                                            </Typography>
                                            <Typography component="span" variant="caption" color="text.secondary">{displaySub}</Typography>
                                        </Box>
                                    } 
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        );
    }
  };

  return (
    <Dialog 
        open={open} 
        onClose={!instruction?.isAccepted ? onClose : undefined} 
        maxWidth="xs" 
        fullWidth 
        PaperProps={DESIGN_TOKENS.glassCard}
    >
      <DialogContent sx={{ pb: 4 }}>
        {renderContent()}
      </DialogContent>
      {/* SHOW ACTIONS ONLY IF: No instruction, OR Accepted (to show Start button) */}
      {(!instruction || instruction.isAccepted) && (
          <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2 }}>
              
              {instruction?.isAccepted && (
                  <Button 
                    variant="contained" 
                    fullWidth 
                    onClick={handleSmartStart}
                    color={allDone ? "success" : "primary"}
                    sx={{ mb: 1, py: 1.5 }}
                  >
                      {allDone 
                        ? "Fertig / Schließen" 
                        : (verifiedCount > 0 ? `Restliche Starten (${remainingCount})` : "Alle Starten (Ohne Scan)")
                      }
                  </Button>
              )}
              
              <Button onClick={onClose} fullWidth color="inherit">Schließen</Button>
          </DialogActions>
      )}
    </Dialog>
  );
}
