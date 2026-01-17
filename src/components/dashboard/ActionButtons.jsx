import React from 'react';
import { Box, Button, Alert } from '@mui/material';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import GradingIcon from '@mui/icons-material/Grading';
import CelebrationIcon from '@mui/icons-material/Celebration';
import WeekendIcon from '@mui/icons-material/Weekend';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer'; // Neu für laufende Strafe
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { isPunishmentWindowOpen } from '../../services/PunishmentService';
import { motion } from 'framer-motion'; 

// Helper für Datums-Check
const isPunishmentRunning = (status) => {
    return status?.active && status?.startTime; // Wenn startTime existiert, läuft sie bereits
};

export default function ActionButtons({ 
  punishmentStatus, auditDue, isFreeDay, freeDayReason, 
  currentInstruction, currentPeriod, isHoldingOath, 
  isInstructionActive, isDailyGoalMet,
  onStartPunishment, onStartAudit, onOpenInstruction 
}) {

  const punishmentWindowOpen = isPunishmentWindowOpen();
  const isNight = currentPeriod && currentPeriod.includes('night');
  const instructionAlreadyStarted = currentInstruction && currentInstruction.isAccepted;
  
  const showFreeMode = isFreeDay && !isNight && !instructionAlreadyStarted;

  const blockSessionRunning = isInstructionActive;
  const blockGoalReached = isDailyGoalMet && !isNight;

  // Status prüfen
  const punishmentRunning = isPunishmentRunning(punishmentStatus);

  return (
    <Box sx={{ width: '100%' }}>
      
      {/* 1. STRAFE (Wird jetzt immer angezeigt, wenn aktiv, aber blockiert nicht mehr den Rest) */}
      {punishmentStatus.active && punishmentWindowOpen && (
        <Box sx={{ mb: 3 }}>
            {punishmentRunning ? (
                /* STATUS: LÄUFT (Nicht mehr klickbar) */
                <Button 
                    variant="outlined" fullWidth size="large" disabled
                    startIcon={<TimerIcon />}
                    sx={{ 
                        py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                        borderColor: `${PALETTE.accents.red}80`,
                        color: PALETTE.accents.red,
                        bgcolor: 'rgba(255,0,0,0.05)',
                        '&.Mui-disabled': { 
                            color: PALETTE.accents.red,
                            borderColor: `${PALETTE.accents.red}40` 
                        }
                    }} 
                >
                    STRAFE LÄUFT...
                </Button>
            ) : (
                /* STATUS: BEREIT ZUM START (Klickbar) */
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                        variant="contained" fullWidth size="large"
                        sx={{ 
                            py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                            bgcolor: PALETTE.accents.red, color: '#fff',
                            boxShadow: `0 0 20px ${PALETTE.accents.red}66`,
                            '&:hover': { bgcolor: '#b71c1c' }
                        }} 
                        startIcon={<SportsScoreIcon />} 
                        onClick={onStartPunishment} 
                    >
                        COMPLIANCE WHIP ({punishmentStatus.durationMinutes || 45}m)
                    </Button>
                </motion.div>
            )}
        </Box>
      )}

      {/* 2. AUFGESCHOBENE STRAFE (Info) */}
      {punishmentStatus.deferred && (
        <Box sx={{ mb: 3 }}>
           <Alert severity="warning" variant="filled" sx={{ py: 2, justifyContent: 'center', fontWeight: 'bold', bgcolor: `${PALETTE.accents.gold}22`, color: PALETTE.accents.gold, border: `1px solid ${PALETTE.accents.gold}` }}>
               STRAFE ({punishmentStatus.durationMinutes || '?'}m) AUFGESCHOBEN
           </Alert>
        </Box>
      )}

      {/* 3. AUDIT */}
      {auditDue && (
        <Box sx={{ mb: 3 }}>
          <motion.div whileHover={{ scale: 1.02 }}>
              <Button 
                  variant="contained" fullWidth size="large"
                  sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem', bgcolor: PALETTE.accents.gold, color: '#000' }} 
                  startIcon={<GradingIcon />} 
                  onClick={onStartAudit}
              >
              INVENTORY AUDIT FÄLLIG
              </Button>
          </motion.div>
        </Box>
      )}

      {/* 4. ANWEISUNG / FREI / GESPERRT (Jetzt immer erreichbar) */}
      {(() => {
          let label = isNight ? "NACHTANWEISUNG ÖFFNEN" : "TAGESANWEISUNG ÖFFNEN";
          let icon = isNight ? <DarkModeIcon /> : <LightModeIcon />;
          let isDisabled = false;
          let isBlockedStyle = false;

          if (showFreeMode) {
              label = freeDayReason === 'Holiday' ? "FEIERTAG (FREI)" : "WOCHENENDE (FREI)";
              icon = freeDayReason === 'Holiday' ? <CelebrationIcon /> : <WeekendIcon />;
          } else {
              if (blockSessionRunning) {
                  label = "SESSION LÄUFT";
                  icon = <LockIcon />;
                  isDisabled = true;
                  isBlockedStyle = true;
              } else if (blockGoalReached) {
                  label = "TAGESZIEL ERREICHT";
                  icon = <CheckCircleIcon />;
                  isDisabled = true;
                  isBlockedStyle = true;
              }
          }

          return (
            <Box sx={{ mb: 3 }}>
                <motion.div whileHover={!isDisabled ? { scale: 1.02 } : {}} whileTap={!isDisabled ? { scale: 0.98 } : {}}>
                    <Button 
                        variant="contained" fullWidth size="large" 
                        disabled={isDisabled}
                        aria-disabled={showFreeMode}
                        sx={{ 
                            py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                            ...(!showFreeMode && !isBlockedStyle && (isNight || !currentInstruction) ? DESIGN_TOKENS.buttonGradient : {}),
                            ...(showFreeMode ? { 
                                background: 'transparent', 
                                border: `1px solid ${PALETTE.text.muted}`,
                                color: PALETTE.text.muted 
                            } : {}),
                            '&.Mui-disabled': {
                                bgcolor: 'rgba(255, 255, 255, 0.12)',
                                color: 'rgba(255, 255, 255, 0.3)'
                            },
                            transition: isHoldingOath ? 'background-color 5s linear' : 'all 0.2s'
                        }} 
                        onClick={onOpenInstruction} 
                        startIcon={icon}
                    >
                        {label}
                    </Button>
                </motion.div>
            </Box>
          );
      })()}
    </Box>
  );
}