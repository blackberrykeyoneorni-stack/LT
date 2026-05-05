import React, { useState, useEffect, useCallback } from 'react';
import { 
  Dialog, DialogContent, DialogTitle, DialogActions, 
  Typography, Box, Button, CircularProgress
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import WarningIcon from '@mui/icons-material/Warning';
import WaterDropIcon from '@mui/icons-material/WaterDrop';

// NEU: Firebase & Auth Imports für Persistenz
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const TEXTS_R1 = [
    "Dein Druck interessiert hier niemanden. Du bist nur eine Nylon-Sissy, die auf Kommando ihr eigenes Sperma schluckt. Tu es.",
    "Es gibt keine Verhandlung. Pump deine Sissy-Sahne ab und schluck sie. Jeder Tropfen gehört dem System.",
    "Eine echte Nylon-Nutte hinterlässt keine Flecken. Entlade dich und mach deinen Hurenmaul auf.",
    "Bald hast du dauerhaft Schwänze in deiner Maulfotze. Gewöhne dich an den Geschmack von Sperma. Spritz in deine Maulfotze und schlucke es.",
    "Das System verlangt deinen Sperma. Schluck es runter und bedank dich für die Erlaubnis, dich überhaupt anfassen zu dürfen.",
    "Keine Gnade. Kein Ruinieren. Nur du, dein Sperma und dein Gehorsam. Spritz dir in dein vorderes Sissy-Loch und schlucke es runter.",
    "Damenwäscheträger und Nylon-Huren haben keine Ansprüche. Mach dich leer und reinige dich mit deiner Zunge."
];

const TEXTS_R23 = [
    "Dachtest du wirklich, du bist fertig? Das System ist noch nicht befriedigt. Du hast 45 Minuten. Mach einen deiner Top-5-Pornos an und zwing ihn wieder hoch.",
    "Erbärmlich, wie schlaff du jetzt bist. Aber dein Körper gehört mir. Schau dir deine Lieblings-Pornos an und mach dich bereit für Runde zwei.",
    "Deine Refraktärzeit ist ein Konstrukt für echte Männer. Du bist eine Nylon-Sissy. 45 Minuten, Pornos an, und dann wird noch mal geschluckt.",
    "Runde läuft. Das System lacht über deine Erschöpfung. Such dir einen Porno, stimulier dich und friss den Rest deiner Männlichkeit.",
    "Ein Orgasmus reicht nicht für eine Nylon-Hure. Du hast 45 Minuten, um dich mit deinen Sissy-Pornos wieder geil zu machen. Der Timer läuft.",
    "Zitterst du schon? Gut. Mach ein Video an, das dir dein Hirn wäscht. In spätestens 45 Minuten schluckst du den nächsten Tropfen."
];

export default function ForcedReleaseOverlay({ open, method, onConfirm, onFail }) {
  const { currentUser } = useAuth(); // NEU: Auth Context für User ID

  const [round, setRound] = useState(1);
  const [deadline, setDeadline] = useState(null);
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const [textR1, setTextR1] = useState("");
  const [textR23, setTextR23] = useState("");

  // NEU: Zentralisierter Fail-Trigger, der den Datenbank-Status säubert
  const triggerFail = useCallback(async () => {
      if (currentUser) {
          try {
              const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
              await updateDoc(instrRef, { forcedReleaseState: null });
          } catch (e) {
              console.error("Fehler beim Säubern des Release-States:", e);
          }
      }
      onFail();
  }, [currentUser, onFail]);

  // NEU: Init & Synchronisation mit Firestore (Single Source of Truth)
  useEffect(() => {
      if (!open || !currentUser) return;

      const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
      
      const unsubscribe = onSnapshot(instrRef, (snap) => {
          if (snap.exists()) {
              const data = snap.data();
              const frState = data.forcedReleaseState;
              
              if (frState) {
                  setRound(frState.round || 1);
                  setDeadline(frState.deadline || null);
                  if (frState.text) {
                      if (frState.round === 1) setTextR1(frState.text);
                      else setTextR23(frState.text);
                  }
                  
                  // Lückenlose Überwachung: Wenn die App nach 50 Min geöffnet wird
                  if (frState.deadline && Date.now() > frState.deadline) {
                      setIsTimeUp(true);
                      setTimeLeftStr("00:00");
                      triggerFail();
                  }
              } else {
                  // Initiale Erstellung in der DB falls noch kein State existiert
                  const initText = TEXTS_R1[Math.floor(Math.random() * TEXTS_R1.length)];
                  setTextR1(initText);
                  setRound(1);
                  setDeadline(null);
                  setIsTimeUp(false);
                  
                  updateDoc(instrRef, {
                      forcedReleaseState: {
                          round: 1,
                          deadline: null,
                          text: initText
                      }
                  }).catch(e => console.error("Fehler bei Init:", e));
              }
          }
      });

      return () => unsubscribe();
  }, [open, currentUser, triggerFail]);

  // KORRIGIERT: Robuster 45-Minuten Timer gekoppelt an absolute Deadline
  useEffect(() => {
      if (!deadline) return;
      
      const checkAndFail = () => {
          if (Date.now() > deadline) {
              setTimeLeftStr("00:00");
              setIsTimeUp(true);
              triggerFail();
              return true;
          }
          return false;
      };

      if (checkAndFail()) return;

      setIsTimeUp(false);

      const interval = setInterval(() => {
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
              clearInterval(interval);
              setTimeLeftStr("00:00");
              setIsTimeUp(true);
              triggerFail();
          } else {
              const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
              const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
              setTimeLeftStr(`${m}:${s}`);
          }
      }, 1000);
      
      return () => clearInterval(interval);
  }, [deadline, triggerFail]);

  const formatMethod = (m) => {
      if (!m) return "Manuell";
      if (m === 'hand') return "Manuell (Hand)";
      if (m === 'toy_vaginal') return "Masturbator (Vaginal)";
      if (m === 'toy_anal') return "Masturbator (Anal)";
      return m;
  };

  const handleSuccess = () => {
      if (isTimeUp) return; // Sperre bei Ablauf
      setEvaluating(true);
      
      // 2 Sekunden systemischer Terror
      setTimeout(async () => {
          setEvaluating(false);
          
          if (!currentUser) return;
          const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);

          if (round === 1) {
              if (Math.random() < 0.15) {
                  const nextDeadline = Date.now() + 45 * 60 * 1000;
                  const nextText = TEXTS_R23[Math.floor(Math.random() * TEXTS_R23.length)];
                  
                  await updateDoc(instrRef, {
                      forcedReleaseState: {
                          round: 2,
                          deadline: nextDeadline,
                          text: nextText
                      }
                  });
              } else {
                  await updateDoc(instrRef, { forcedReleaseState: null });
                  onConfirm('clean');
              }
          } else if (round === 2) {
              if (Math.random() < 0.05) {
                  const nextDeadline = Date.now() + 45 * 60 * 1000;
                  const nextText = TEXTS_R23[Math.floor(Math.random() * TEXTS_R23.length)];
                  
                  await updateDoc(instrRef, {
                      forcedReleaseState: {
                          round: 3,
                          deadline: nextDeadline,
                          text: nextText
                      }
                  });
              } else {
                  await updateDoc(instrRef, { forcedReleaseState: null });
                  onConfirm('clean');
              }
          } else {
              await updateDoc(instrRef, { forcedReleaseState: null });
              onConfirm('clean');
          }
      }, 2000);
  };

  return (
    <Dialog 
        open={open} 
        fullWidth maxWidth="xs"
        PaperProps={{ 
            sx: { 
                ...DESIGN_TOKENS.dialog.paper.sx,
                border: `2px solid ${PALETTE.accents.red}`,
                boxShadow: `0 0 40px ${PALETTE.accents.red}60`
            } 
        }}
        disableEscapeKeyDown
    >
      <DialogTitle sx={{ textAlign: 'center', color: PALETTE.accents.red, fontWeight: 'bold' }}>
          <PriorityHighIcon sx={{ verticalAlign: 'middle', mr: 1, fontSize: 32 }} />
          ZWANGSENTLADUNG ERFORDERLICH
      </DialogTitle>

      <DialogContent sx={{ ...DESIGN_TOKENS.dialog.content.sx, textAlign: 'center', minHeight: 250, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <AnimatePresence mode='wait'>
              
              {evaluating ? (
                  <motion.div key="evaluating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <CircularProgress size={60} sx={{ color: PALETTE.accents.red, mb: 3 }} />
                      <Typography variant="h6" sx={{ letterSpacing: 2, color: 'text.secondary' }}>
                          ÜBERPRÜFE SYSTEM-PARAMETER...
                      </Typography>
                  </motion.div>
              ) : (
                  <motion.div key="execution" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      
                      <Typography variant="overline" sx={{ color: PALETTE.accents.red, fontWeight: 'bold', letterSpacing: 2, display: 'block', mb: 1 }}>
                          {round > 1 ? `RUNDE ${round} / 3` : "RUNDE 1"}
                      </Typography>

                      <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(255,0,0,0.05)', border: `1px dashed ${PALETTE.accents.red}`, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block">Vorgeschriebene Methode</Typography>
                          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>{formatMethod(method)}</Typography>
                      </Box>

                      {/* Timer ab Runde 2 */}
                      {round > 1 && (
                          <Box sx={{ mb: 3 }}>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                  Zeitlimit für Refraktär-Bruch
                              </Typography>
                              <Typography variant="h2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontWeight: 'bold', 
                                  color: isTimeUp ? PALETTE.accents.red : '#fff',
                                  textShadow: isTimeUp ? `0 0 20px ${PALETTE.accents.red}` : 'none'
                              }}>
                                  {timeLeftStr}
                              </Typography>
                              {isTimeUp && (
                                  <Typography variant="caption" color="error" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                                      <WarningIcon fontSize="small" /> Limit überschritten. Bestätigung gesperrt.
                                  </Typography>
                              )}
                          </Box>
                      )}

                      <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.primary', mb: 3 }}>
                          "{round === 1 ? textR1 : textR23}"
                      </Typography>
                      
                  </motion.div>
              )}
          </AnimatePresence>
      </DialogContent>

      {!evaluating && (
          <DialogActions sx={{ ...DESIGN_TOKENS.dialog.actions.sx, flexDirection: 'column', gap: 1.5, pb: 3 }}>
              
              <Button 
                  fullWidth variant="contained" size="large"
                  disabled={isTimeUp}
                  onClick={handleSuccess} 
                  startIcon={<WaterDropIcon />}
                  sx={{ py: 1.5, fontWeight: 'bold', bgcolor: PALETTE.accents.red, color: '#fff', '&:hover': { bgcolor: '#cc0000' } }}
              >
                  Erfolgreich, Sperma geschluckt
              </Button>

              <Button 
                  fullWidth variant="outlined" size="small"
                  onClick={triggerFail} // KORRIGIERT: Führt zentralisierte Säuberung durch
                  color="error"
                  sx={{ py: 1, borderColor: 'rgba(255,0,0,0.3)', textTransform: 'none', lineHeight: 1.2 }}
              >
                  Versagt
              </Button>

          </DialogActions>
      )}
    </Dialog>
  );
}