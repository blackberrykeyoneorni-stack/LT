import React, { useState, useEffect, useRef } from 'react';
import { 
    Card, CardContent, Typography, Box, Button, Chip, LinearProgress, Avatar,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
    List, ListItem, ListItemAvatar, ListItemText, Switch
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import useUIStore from '../../store/uiStore';
import { addPenaltyToActivePunishment } from '../../services/PunishmentService';

export default function ActiveSessionsList({ activeSessions, items, onStopSession, onNavigateItem, onOpenRelease }) {
  const { currentUser } = useAuth();
  const showToast = useUIStore(s => s.showToast);

  const [gatekeeperSession, setGatekeeperSession] = useState(null);
  const [confessionText, setConfessionText] = useState("");

  // --- SEAMLESS TRANSITION STATE ---
  const [transitionDialog, setTransitionDialog] = useState(null);
  const [keptItems, setKeptItems] = useState([]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- DIE UNGEDULDS-STEUER ---
  const handleCheckPunishment = async (session, durationMinutes, minDuration) => {
      if (durationMinutes >= minDuration) {
          setGatekeeperSession(session);
          setConfessionText('');
      } else {
          try {
              if (currentUser) {
                  await addPenaltyToActivePunishment(currentUser.uid, session.id, 10);
              }
              showToast("Zu früh, dein Arsch wird weiter durchgefickt.", "error");
          } catch (e) {
              console.error(e);
          }
      }
  };

  // --- DAS FINALE GESTÄNDNIS ---
  const handleGatekeeperSubmit = async () => {
      const requiredText = "Ich bin eine gehorsame Sissy und danke für die Zurechtweisung";
      if (confessionText === requiredText) {
          onStopSession(gatekeeperSession);
          setGatekeeperSession(null);
      } else {
          try {
              if (currentUser) {
                  await addPenaltyToActivePunishment(currentUser.uid, gatekeeperSession.id, 15);
              }
              showToast("Tippfehler erkannt! +15 Minuten Strafaufschlag.", "error");
              setGatekeeperSession(null);
          } catch (e) {
              console.error(e);
          }
      }
  };

  // --- SEAMLESS TRANSITION HANDLER ---
  const handleToggleKeep = (id) => {
      setKeptItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  if (!activeSessions || activeSessions.length === 0) return null;

  const formatDuration = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h > 0) return `${h} h ${m} min`;
      return `${m} min`;
  };

  return (
    <Box sx={{ mb: 4 }}>
      <AnimatePresence>
        {activeSessions.map((session) => {
            let sessionItems = [];
            if (Array.isArray(session.itemIds) && session.itemIds.length > 0) {
                sessionItems = session.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean);
            } else if (session.itemId) {
                const singleItem = items.find(i => i.id === session.itemId);
                if (singleItem) sessionItems = [singleItem];
            }

            // Gesamtdauer der Session (Relevant für ProgressBars und Locks)
            // Startet erst, wenn die Anweisung GÄNZLICH erfüllt ist (instructionReadyTime)
            const fallbackStartTime = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
            let sessionComplianceStartTime = fallbackStartTime;
            
            if (session.type === 'instruction' && session.instructionReadyTime) {
                const readyData = session.instructionReadyTime;
                sessionComplianceStartTime = readyData.toDate ? readyData.toDate() : new Date(readyData);
            } else if (session.type === 'preparation') {
                sessionComplianceStartTime = new Date(); // Dauer bleibt faktisch 0, bis es zur instruction wird
            }

            const durationMinutes = Math.max(0, Math.floor((new Date() - sessionComplianceStartTime) / 60000));
            
            const minDuration = session.minDuration || 0;
            const isPunishment = session.type === 'punishment';
            const isTZD = session.type === 'tzd' || session.tzdExecuted; 
            
            const isDebtLocked = session.isDebtSession && durationMinutes < minDuration;
            const isLocked = isDebtLocked; 
            const remainingTime = Math.max(0, minDuration - durationMinutes);
            
            let typeLabel = "FREIWILLIG";
            let borderColor = PALETTE.primary.main;
            let chipColor = PALETTE.primary.main; 
            let chipBg = '#000000'; 

            if (session.isDebtSession) {
                typeLabel = "SCHULDENTILGUNG";
                borderColor = PALETTE.accents.red;
                chipColor = PALETTE.accents.red;
                chipBg = '#FFFFFF'; 
            } else if (isPunishment) {
                typeLabel = "STRAFARBEIT";
                borderColor = PALETTE.accents.red;
                chipColor = PALETTE.accents.red;
                chipBg = '#FFFFFF';
            } else if (isTZD) {
                typeLabel = "ZEITLOSES DIKTAT";
                borderColor = PALETTE.accents.red;
                chipColor = PALETTE.accents.red;
                chipBg = '#FFFFFF';
            } else if (session.type === 'instruction') {
                typeLabel = "INSTRUCTION";
                borderColor = PALETTE.accents.gold;
                chipColor = PALETTE.accents.gold;
                chipBg = '#000000'; 
            } else if (session.type === 'preparation') {
                typeLabel = "UMKLEIDE (STAGING)";
                borderColor = PALETTE.accents.blue;
                chipColor = PALETTE.accents.blue;
                chipBg = '#000000';
            }

            return (
                <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card sx={{ 
                        mb: 2, 
                        ...DESIGN_TOKENS.glassCard,
                        borderLeft: `4px solid ${borderColor}` 
                    }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Chip 
                                    label={typeLabel} 
                                    sx={{ 
                                        fontWeight: 900, 
                                        fontSize: '0.75rem', 
                                        height: '24px',
                                        color: chipColor,
                                        bgcolor: chipBg,
                                        border: `2px solid ${chipColor}`,
                                        boxShadow: `0 0 10px ${chipColor}40`,
                                        textShadow: chipBg === '#000000' ? `0 0 5px ${chipColor}` : 'none'
                                    }}
                                />
                                {isLocked && (
                                    <Chip 
                                        label="LOCKED" 
                                        size="small" 
                                        icon={<LockIcon fontSize="small"/>} 
                                        color="error" 
                                        variant="outlined"
                                        sx={{ height: '24px' }}
                                    />
                                )}
                            </Box>

                            {/* INDIVIDUELLE ITEM LISTE */}
                            {sessionItems.length > 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                    {sessionItems.map((item, idx) => {
                                        // Individuelle Zeit aus dem Ledger holen
                                        let itemStartTime = fallbackStartTime;
                                        if (session.itemLedger && session.itemLedger[item.id] && session.itemLedger[item.id].joinedAt) {
                                            const joinedData = session.itemLedger[item.id].joinedAt;
                                            itemStartTime = joinedData.toDate ? joinedData.toDate() : new Date(joinedData);
                                        }
                                        const itemDurationMinutes = Math.max(0, Math.floor((new Date() - itemStartTime) / 60000));

                                        return (
                                            <Box 
                                                key={item.id || idx} 
                                                onClick={() => onNavigateItem(item.id)}
                                                sx={{ 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    p: 1, borderRadius: 1, 
                                                    bgcolor: 'rgba(255,255,255,0.05)',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s',
                                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Avatar 
                                                        src={item.imageUrl || item.image} 
                                                        variant="rounded" 
                                                        sx={{ width: 40, height: 40, border: `1px solid ${PALETTE.primary.main}` }}
                                                    />
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                                                            {item.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.brand}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <Chip 
                                                    label={formatDuration(itemDurationMinutes)} 
                                                    size="small" 
                                                    variant="outlined"
                                                    sx={{ 
                                                        height: '20px', 
                                                        fontSize: '0.7rem', 
                                                        borderColor: 'rgba(255,255,255,0.2)', 
                                                        color: 'text.secondary' 
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}

                            {/* PROGRESS BAR - Versteckt für Punishment */}
                            {session.isDebtSession && minDuration > 0 && (
                                <Box sx={{ mt: 1, mb: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="error">
                                            Pflicht-Tilgung
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">{durationMinutes} / {minDuration} min</Typography>
                                    </Box>
                                    <LinearProgress 
                                        variant="determinate" 
                                        value={Math.min(100, (durationMinutes / minDuration) * 100)} 
                                        color="error"
                                        sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,0,0,0.1)' }}
                                    />
                                </Box>
                            )}

                            {/* ACTIONS */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                {session.type === 'preparation' ? (
                                    <Button 
                                        variant="outlined" 
                                        size="small"
                                        fullWidth
                                        disabled
                                        sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'text.disabled' }}
                                    >
                                        VERIFIKATION AUSSTEHEND
                                    </Button>
                                ) : isPunishment ? (
                                    <Button 
                                        variant="contained"
                                        size="small"
                                        fullWidth
                                        startIcon={<VisibilityIcon />}
                                        onClick={() => handleCheckPunishment(session, durationMinutes, minDuration)}
                                        sx={{
                                            bgcolor: PALETTE.accents.red,
                                            color: '#fff',
                                            '&:hover': { bgcolor: '#b71c1c' }
                                        }}
                                    >
                                        VOLLZUG PRÜFEN
                                    </Button>
                                ) : (isTZD || session.isDebtSession) ? (
                                    <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
                                        {isLocked && session.isDebtSession && (
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                color="error"
                                                onClick={() => {
                                                    if(window.confirm("SYSTEMWARNUNG: Ein Not-Abbruch vernichtet die bisherige Tragezeit und erhöht deine Schulden sofort um 50% (Overdraft Penalty). Fortfahren?")) {
                                                        onStopSession(session, { emergencyBailout: true });
                                                    }
                                                }}
                                                sx={{ flex: 1, borderColor: PALETTE.accents.red, color: PALETTE.accents.red, fontWeight: 'bold' }}
                                            >
                                                NOT-ABBRUCH
                                            </Button>
                                        )}
                                        <Button 
                                            variant={isLocked ? "outlined" : "contained"} 
                                            size="small"
                                            disabled={isLocked}
                                            onClick={() => onStopSession(session)}
                                            startIcon={isLocked ? <LockIcon /> : <StopIcon />}
                                            sx={isLocked ? { 
                                                flex: session.isDebtSession ? 1 : 'none',
                                                width: session.isDebtSession ? 'auto' : '100%',
                                                borderColor: 'rgba(255,255,255,0.1)',
                                                color: 'text.disabled'
                                            } : {
                                                fullWidth: true,
                                                bgcolor: PALETTE.primary.main,
                                                color: '#000',
                                                '&:hover': { bgcolor: PALETTE.primary.dark }
                                            }}
                                        >
                                            {isLocked ? `GESPERRT (${remainingTime}m)` : "BEENDEN"}
                                        </Button>
                                    </Box>
                                ) : (
                                    <Button 
                                        variant="contained" 
                                        color="primary" 
                                        size="small"
                                        fullWidth
                                        onClick={() => {
                                            if (session.type === 'instruction') {
                                                setTransitionDialog(session);
                                                setKeptItems([]);
                                            } else {
                                                onStopSession(session);
                                            }
                                        }}
                                        startIcon={<StopIcon />}
                                    >
                                        Beenden
                                    </Button>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </motion.div>
            );
        })}
      </AnimatePresence>

      {/* GATEKEEPER DIALOG */}
      <Dialog
          open={!!gatekeeperSession}
          onClose={() => {}} 
          PaperProps={{
              sx: { ...DESIGN_TOKENS.glassCard, border: `1px solid ${PALETTE.accents.red}` }
          }}
      >
          <DialogTitle sx={{ color: PALETTE.accents.red, fontWeight: 'bold' }}>
              FINALES GESTÄNDNIS
          </DialogTitle>
          <DialogContent>
              <DialogContentText sx={{ color: 'text.secondary', mb: 2 }}>
                  Die Strafzeit ist abgelaufen. Das System erfordert nun deine absolute Demut. Tippe den exakten Satz fehlerfrei und case-sensitive ab, um die Strafe zu beenden:
              </DialogContentText>
              <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold', mb: 3, fontStyle: 'italic', textAlign: 'center' }}>
                  "Ich bin eine gehorsame Sissy und danke für die Zurechtweisung"
              </Typography>
              <TextField
                  autoFocus
                  fullWidth
                  variant="outlined"
                  value={confessionText}
                  onChange={(e) => setConfessionText(e.target.value)}
                  autoComplete="off"
                  sx={{
                      '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                          '&:hover fieldset': { borderColor: PALETTE.accents.red },
                          '&.Mui-focused fieldset': { borderColor: PALETTE.accents.red },
                      }
                  }}
              />
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button onClick={() => setGatekeeperSession(null)} sx={{ color: 'text.secondary' }}>Abbrechen</Button>
              <Button onClick={handleGatekeeperSubmit} variant="contained" sx={{ bgcolor: PALETTE.accents.red, color: '#fff', '&:hover': { bgcolor: '#b71c1c'} }}>
                  Bestätigen
              </Button>
          </DialogActions>
      </Dialog>

      {/* SEAMLESS TRANSITION DIALOG */}
      {transitionDialog && (
          <Dialog
              open={!!transitionDialog}
              onClose={() => setTransitionDialog(null)}
              PaperProps={{
                  sx: { ...DESIGN_TOKENS.glassCard, border: `1px solid ${PALETTE.accents.blue}` }
              }}
              maxWidth="xs"
              fullWidth
          >
              <DialogTitle sx={{ color: PALETTE.accents.blue, fontWeight: 'bold' }}>
                  NAHTLOSER ÜBERGANG
              </DialogTitle>
              <DialogContent>
                  <DialogContentText sx={{ color: 'text.secondary', mb: 2 }}>
                      Die Pflicht ist erfüllt. Welche Items möchtest du freiwillig anbehalten? Nicht ausgewählte Items werden abgelegt.
                  </DialogContentText>
                  <List sx={{ bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
                      {(() => {
                          const tIds = transitionDialog.itemIds || (transitionDialog.itemId ? [transitionDialog.itemId] : []);
                          return tIds.map(id => {
                              const item = items.find(i => i.id === id);
                              if (!item) return null;
                              return (
                                  <ListItem key={id} divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                      <ListItemAvatar>
                                          <Avatar 
                                              src={item.imageUrl || item.image} 
                                              variant="rounded" 
                                              sx={{ width: 40, height: 40, border: `1px solid ${PALETTE.accents.blue}` }} 
                                          />
                                      </ListItemAvatar>
                                      <ListItemText 
                                          primary={item.name} 
                                          secondary={item.subCategory}
                                          primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' } }}
                                          secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' } }}
                                      />
                                      <Switch 
                                          checked={keptItems.includes(id)}
                                          onChange={() => handleToggleKeep(id)}
                                          sx={{ 
                                              '& .MuiSwitch-switchBase.Mui-checked': { color: PALETTE.accents.blue },
                                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: PALETTE.accents.blue }
                                          }}
                                      />
                                  </ListItem>
                              );
                          });
                      })()}
                  </List>
              </DialogContent>
              <DialogActions sx={{ p: 2, pt: 0 }}>
                  <Button onClick={() => setTransitionDialog(null)} sx={{ color: 'text.secondary' }}>
                      Abbrechen
                  </Button>
                  <Button 
                      onClick={() => {
                          onStopSession(transitionDialog, { keptItemIds: keptItems });
                          setTransitionDialog(null);
                      }} 
                      variant="contained" 
                      sx={{ bgcolor: PALETTE.accents.blue, color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#fff'} }}
                  >
                      Session Beenden
                  </Button>
              </DialogActions>
          </Dialog>
      )}

    </Box>
  );
}