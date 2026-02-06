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
import TimerIcon from '@mui/icons-material/Timer'; 
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { isPunishmentWindowOpen } from '../../services/PunishmentService';
import { motion } from 'framer-motion'; 

export default function ActionButtons({ 
  punishmentStatus, 
  punishmentRunning, 
  auditDue, isFreeDay, freeDayReason, 
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

  return (
    <Box sx={{ width: '100%' }}>
      
      {/* 1. STRAFE (Top Priorität) */}
      {punishmentStatus.active && punishmentWindowOpen && (
        <Box sx={{ mb: 3 }}>
            {punishmentRunning ? (
                <Button 
                    variant="outlined" fullWidth size="large" disabled
                    startIcon={<TimerIcon />}
                    sx={{ 
                        py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                        borderColor: `${PALETTE.accents.red}80`, color: PALETTE.accents.red,
                        bgcolor: 'rgba(255,0,0,0.05)'
                    }} 
                >
                    STRAFE LÄUFT...
                </Button>
            ) : (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                        variant="contained" fullWidth size="large"
                        sx={{ 
                            py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                            bgcolor: PALETTE.accents.red, color: '#fff',
                            boxShadow: `0 0 20px ${PALETTE.accents.red}66`,
                            '&:hover': { bgcolor: '#b71c1c' }
                        }} 
                        startIcon={<SportsScoreIcon />} onClick={onStartPunishment} 
                    >
                        COMPLIANCE WHIP ({punishmentStatus.durationMinutes || 45}m)
                    </Button>
                </motion.div>
            )}
        </Box>
      )}

      {/* 2. AUDIT */}
      {auditDue && (
        <Box sx={{ mb: 3 }}>
          <motion.div whileHover={{ scale: 1.02 }}>
              <Button 
                  variant="contained" fullWidth size="large"
                  sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem', bgcolor: PALETTE.accents.gold, color: '#000' }} 
                  startIcon={<GradingIcon />} onClick={onStartAudit}
              >
              INVENTORY AUDIT FÄLLIG
              </Button>
          </motion.div>
        </Box>
      )}

      {/* 3. HAUPT BUTTON (Instruction) */}
      {(() => {
          let label = isNight ? "NACHTANWEISUNG ÖFFNEN" : "TAGESANWEISUNG ÖFFNEN";
          let icon = isNight ? <DarkModeIcon /> : <LightModeIcon />;
          let isDisabled = false;
          let isBlockedStyle = false;

          const freeModeSx = {
              background: 'rgba(255,255,255,0.05)', 
              border: `1px solid ${PALETTE.accents.green}`, 
              color: PALETTE.accents.green
          };

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
            <Box sx={{ mb: 2 }}>
                <motion.div whileHover={!isDisabled ? { scale: 1.02 } : {}} whileTap={!isDisabled ? { scale: 0.98 } : {}}>
                    <Button 
                        variant="contained" fullWidth size="large" 
                        disabled={isDisabled}
                        sx={{ 
                            py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                            ...(!showFreeMode && !isBlockedStyle ? DESIGN_TOKENS.buttonGradient : {}),
                            ...(showFreeMode ? freeModeSx : {}),
                            '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.3)' },
                            transition: isHoldingOath ? 'background-color 5s linear' : 'all 0.2s'
                        }} 
                        onClick={onOpenInstruction} startIcon={icon}
                    >
                        {label}
                    </Button>
                </motion.div>
            </Box>
          );
      })()}

      {/* 5. Deferred Info */}
      {punishmentStatus.deferred && (
        <Alert severity="warning" variant="filled" sx={{ mt: 2, fontWeight: 'bold', bgcolor: `${PALETTE.accents.gold}22`, color: PALETTE.accents.gold, border: `1px solid ${PALETTE.accents.gold}` }}>
            STRAFE ({punishmentStatus.durationMinutes}m) AUFGESCHOBEN
        </Alert>
      )}
    </Box>
  );
}