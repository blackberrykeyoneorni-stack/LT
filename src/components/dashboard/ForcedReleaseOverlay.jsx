import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogTitle, DialogActions, 
  Typography, Box, Button, CircularProgress, 
  IconButton, Zoom 
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { motion, AnimatePresence } from 'framer-motion';

import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import WaterDropIcon from '@mui/icons-material/WaterDrop'; // For Clean/Consume
import DangerousIcon from '@mui/icons-material/Dangerous'; // For Ruined/Soil
import CasinoIcon from '@mui/icons-material/Casino'; // For Rolling
import SanitizerIcon from '@mui/icons-material/Sanitizer'; // Clean icon alternative
import DirtyLensIcon from '@mui/icons-material/DirtyLens'; // Soil icon alternative

export default function ForcedReleaseOverlay({ open, method, onConfirm, onRefuse }) {
  // Stages: 'intro' -> 'rolling' -> 'result'
  const [stage, setStage] = useState('intro');
  const [verdict, setVerdict] = useState(null); // 'clean' or 'ruined'
  const [begged, setBegged] = useState(false);
  const [begMessage, setBegMessage] = useState(null);

  // Reset bei jedem Öffnen
  useEffect(() => {
      if (open) {
          setStage('intro');
          setVerdict(null);
          setBegged(false);
          setBegMessage(null);
      }
  }, [open]);

  const handleRollFate = () => {
      setStage('rolling');
      
      // Simulation der "Berechnung"
      setTimeout(() => {
          // 60% Chance auf Clean, 40% auf Ruined
          const isClean = Math.random() > 0.4;
          setVerdict(isClean ? 'clean' : 'ruined');
          setStage('result');
      }, 2000);
  };

  const handleBegForMercy = () => {
      setStage('rolling');
      setBegged(true);

      setTimeout(() => {
          // 50/50 Chance beim Betteln
          const isMercyGranted = Math.random() > 0.5;
          
          if (isMercyGranted) {
              setVerdict('clean');
              setBegMessage("Gnade gewährt. Schluck deine Sissy-Sahne.");
          } else {
              setVerdict('ruined');
              setBegMessage("ABGELEHNT! Schmier deine Sissy-Soße in deine Uniform. Ruiniere sie!");
          }
          setStage('result');
      }, 1500);
  };

  // Methode schön formatieren
  const formatMethod = (m) => {
      if (!m) return "Manuell";
      if (m === 'hand') return "Manuell (Hand)";
      if (m === 'toy_vaginal') return "Masturbator (Vaginal)";
      if (m === 'toy_anal') return "Masturbator (Anal)";
      return m;
  };

  const isClean = verdict === 'clean';
  
  // Styles basierend auf Ergebnis
  const resultColor = isClean ? PALETTE.accents.green : PALETTE.accents.red;
  const resultBg = isClean ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 0, 0, 0.05)';
  const resultBorder = `1px solid ${resultColor}`;

  return (
    <Dialog 
        open={open} 
        fullWidth maxWidth="xs"
        PaperProps={{ 
            sx: { 
                ...DESIGN_TOKENS.dialog.paper.sx,
                border: stage === 'result' ? `2px solid ${resultColor}` : DESIGN_TOKENS.dialog.paper.sx.border,
                transition: 'border 0.5s ease'
            } 
        }}
        disableEscapeKeyDown
    >
      <DialogTitle sx={{ textAlign: 'center', color: stage === 'result' ? resultColor : PALETTE.text.primary }}>
          {stage === 'intro' && "ZWANGSENTLADUNG"}
          {stage === 'rolling' && "BERECHNE SCHICKSAL..."}
          {stage === 'result' && (isClean ? "PROTOKOLL: PURITY" : "PROTOKOLL: FILTH")}
      </DialogTitle>

      <DialogContent sx={{ ...DESIGN_TOKENS.dialog.content.sx, textAlign: 'center', minHeight: 250, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <AnimatePresence mode='wait'>
              {/* PHASE 1: INTRO */}
              {stage === 'intro' && (
                  <motion.div 
                      key="intro"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                      <PriorityHighIcon sx={{ fontSize: 60, color: PALETTE.primary.main, mb: 2 }} />
                      <Typography variant="body1" gutterBottom>
                          Der Druckpegel hat das Limit überschritten.
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Methode: <strong>{formatMethod(method)}</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          "Wirst du dein Sperma schlucken oder musst du es in deine Nylons einarbeiten? Der Algorithmus entscheidet."
                      </Typography>
                  </motion.div>
              )}

              {/* PHASE 2: ROLLING */}
              {stage === 'rolling' && (
                  <motion.div 
                      key="rolling"
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
                  >
                      <CircularProgress size={60} sx={{ color: PALETTE.accents.gold, mb: 3 }} />
                      <Typography variant="h6" sx={{ letterSpacing: 2 }}>
                          {begged ? "RICHTE ÜBER DICH..." : "WÜRFLE..."}
                      </Typography>
                  </motion.div>
              )}

              {/* PHASE 3: RESULT */}
              {stage === 'result' && (
                  <motion.div 
                      key="result"
                      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  >
                      <Box sx={{ 
                          p: 3, mb: 2, 
                          bgcolor: resultBg, 
                          border: resultBorder, 
                          borderRadius: '16px',
                          position: 'relative',
                          overflow: 'hidden'
                      }}>
                          {/* Icon */}
                          <Box sx={{ mb: 2 }}>
                              {isClean ? 
                                  <WaterDropIcon sx={{ fontSize: 50, color: resultColor }} /> : 
                                  <DangerousIcon sx={{ fontSize: 50, color: resultColor }} />
                              }
                          </Box>

                          {/* Main Directive */}
                          <Typography variant="h5" fontWeight="bold" sx={{ color: resultColor, mb: 1, textTransform: 'uppercase' }}>
                              {isClean ? "VERZEHR PFLICHT" : "STOFF RUINIEREN"}
                          </Typography>

                          {/* Description */}
                          <Typography variant="body2" sx={{ color: 'text.primary', mb: 2 }}>
                              {begMessage ? begMessage : (
                                  isClean 
                                  ? "Verschwende keinen Tropfen. Deine Nylons und Dessous müssen makellos bleiben." 
                                  : "Die Aufnahme ist verboten. Entlade direkt in deine Damenwäsche. Lass es einziehen."
                              )}
                          </Typography>

                          {/* Punishment Hint */}
                          {!isClean && !begged && (
                              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                  Verschmutzung wird im Inventar vermerkt.
                              </Typography>
                          )}
                      </Box>
                  </motion.div>
              )}
          </AnimatePresence>

      </DialogContent>

      <DialogActions sx={{ ...DESIGN_TOKENS.dialog.actions.sx, flexDirection: 'column', gap: 1 }}>
          
          {stage === 'intro' && (
              <Button 
                  fullWidth variant="contained" size="large" 
                  onClick={handleRollFate}
                  startIcon={<CasinoIcon />}
                  sx={{ ...DESIGN_TOKENS.buttonGradient, py: 1.5 }}
              >
                  SCHICKSAL ERMITTELN
              </Button>
          )}

          {stage === 'result' && (
              <>
                  <Button 
                      fullWidth variant="contained" size="large"
                      onClick={() => onConfirm(verdict)} // Pass verdict back
                      color={isClean ? "success" : "error"}
                      sx={{ py: 1.5, fontWeight: 'bold' }}
                  >
                      {isClean ? "GESCHLUCKT & SAUBER" : "TEXTIL VERSCHMUTZT"}
                  </Button>

                  {/* Begging Option: Only if Ruined AND not yet begged */}
                  {!isClean && !begged && (
                      <Button 
                          fullWidth variant="text" 
                          onClick={handleBegForMercy}
                          sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 1 }}
                      >
                          Um Gnade betteln (Chance auf Verzehr)
                      </Button>
                  )}
              </>
          )}

          <Button onClick={onRefuse} fullWidth color="inherit" sx={{ mt: 1, opacity: 0.6 }}>
              Verweigern (Strafe)
          </Button>
      </DialogActions>
    </Dialog>
  );
}