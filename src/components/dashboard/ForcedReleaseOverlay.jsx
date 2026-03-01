import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogTitle, DialogActions, 
  Typography, Box, Button, CircularProgress,
  Zoom 
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import WarningIcon from '@mui/icons-material/Warning';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WaterDropIcon from '@mui/icons-material/WaterDrop';

// --- DEMÜTIGUNGS TEXTE (Aus dem Konzept) ---
const TEXTS_R1 = [
    "Dein Druck interessiert hier niemanden. Du bist nur eine Nylon-Sissy, die auf Kommando ihr eigenes Sperma schluckt. Tu es.",
    "Es gibt keine Verhandlung. Pump deine Sissy-Sahne ab und schluck sie. Jeder Tropfen gehört dem System.",
    "Eine echte Nylon-Nutte hinterlässt keine Flecken. Entlade dich und mach deinen Hurenmaul auf.",
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

const TEXTS_FAIL = [
    "Ich bin eine erbärmliche Sissy und habe die Nylons versaut.",
    "Ich habe versagt. Mein Sperma ist auf der Ausrüstung gelandet.",
    "Zu schwach zum Schlucken – Ich melde einen schmutzigen Unfall.",
    "Ich habe die Kontrolle verloren und das System-Eigentum ruiniert.",
    "Bestrafe mich. Ich war zu ungeschickt und habe Flecken gemacht.",
    "Ich bin wertlos. Die Entladung ging daneben. Registriere den Defekt."
];

export default function ForcedReleaseOverlay({ open, method, onConfirm, onFail, onRefuse }) {
  const [round, setRound] = useState(1);
  const [deadline, setDeadline] = useState(null);
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const [textR1, setTextR1] = useState("");
  const [textR23, setTextR23] = useState("");
  const [textFail, setTextFail] = useState("");

  // Init bei Öffnung
  useEffect(() => {
      if (open) {
          setRound(1);
          setDeadline(null);
          setIsTimeUp(false);
          setEvaluating(false);
          setTextR1(TEXTS_R1[Math.floor(Math.random() * TEXTS_R1.length)]);
          setTextR23(TEXTS_R23[Math.floor(Math.random() * TEXTS_R23.length)]);
          setTextFail(TEXTS_FAIL[Math.floor(Math.random() * TEXTS_FAIL.length)]);
      }
  }, [open]);

  // Robuster 45-Minuten Timer
  useEffect(() => {
      if (!deadline) return;
      
      const interval = setInterval(() => {
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
              setTimeLeftStr("00:00");
              setIsTimeUp(true);
              clearInterval(interval);
          } else {
              const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
              const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
              setTimeLeftStr(`${m}:${s}`);
          }
      }, 1000);
      
      return () => clearInterval(interval);
  }, [deadline]);

  const formatMethod = (m) => {
      if (!m) return "Manuell";
      if (m === 'hand') return "Manuell (Hand)";
      if (m === 'toy_vaginal') return "Masturbator (Vaginal)";
      if (m === 'toy_anal') return "Masturbator (Anal)";
      return m;
  };

  // Exekution und Loop-Entscheidung
  const handleSuccess = () => {
      setEvaluating(true);
      
      // 2 Sekunden systemischer Terror (Warten auf das Urteil)
      setTimeout(() => {
          setEvaluating(false);
          
          if (round === 1) {
              if (Math.random() < 0.15) {
                  // Loop 1 (15%) -> Startet Runde 2
                  setRound(2);
                  setDeadline(Date.now() + 45 * 60 * 1000);
                  setTextR23(TEXTS_R23[Math.floor(Math.random() * TEXTS_R23.length)]);
                  setTextFail(TEXTS_FAIL[Math.floor(Math.random() * TEXTS_FAIL.length)]);
                  setIsTimeUp(false);
              } else {
                  onConfirm('clean');
              }
          } else if (round === 2) {
              if (Math.random() < 0.05) {
                  // Loop 2 (5%) -> Startet finale Runde 3
                  setRound(3);
                  setDeadline(Date.now() + 45 * 60 * 1000);
                  setTextR23(TEXTS_R23[Math.floor(Math.random() * TEXTS_R23.length)]);
                  setTextFail(TEXTS_FAIL[Math.floor(Math.random() * TEXTS_FAIL.length)]);
                  setIsTimeUp(false);
              } else {
                  onConfirm('clean');
              }
          } else {
              // Maximale Ausdauer erreicht (Ende nach Runde 3)
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

                      {/* Dynamischer Demütigungs-Text */}
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
                  GESCHLUCKT & BESTÄTIGT
              </Button>

              {/* Versagens-Button ab Runde 2 */}
              {round > 1 && (
                  <Button 
                      fullWidth variant="outlined" size="small"
                      onClick={onFail}
                      color="error"
                      sx={{ py: 1, borderColor: 'rgba(255,0,0,0.3)', textTransform: 'none', lineHeight: 1.2 }}
                  >
                      {textFail}
                  </Button>
              )}

              <Button onClick={onRefuse} fullWidth color="inherit" sx={{ mt: 1, opacity: 0.4, fontSize: '0.75rem' }}>
                  NOT-ABBRUCH (SYSTEM-STRAFE)
              </Button>
          </DialogActions>
      )}
    </Dialog>
  );
}