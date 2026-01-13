import React from 'react';
import { Box, Button, Alert } from '@mui/material';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import GradingIcon from '@mui/icons-material/Grading';
import CelebrationIcon from '@mui/icons-material/Celebration';
import WeekendIcon from '@mui/icons-material/Weekend';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { isPunishmentWindowOpen } from '../../services/PunishmentService';

export default function ActionButtons({ 
  punishmentStatus, auditDue, isFreeDay, freeDayReason, 
  currentInstruction, currentPeriod, isHoldingOath, 
  onStartPunishment, onStartAudit, onOpenInstruction 
}) {

  const punishmentWindowOpen = isPunishmentWindowOpen();
  const isNight = currentPeriod && currentPeriod.includes('night');
  const instructionAlreadyStarted = currentInstruction && currentInstruction.isAccepted;
  const showFreeMode = isFreeDay && !isNight && !instructionAlreadyStarted;

  // 1. STRAFE (Priorität)
  if (punishmentStatus.active && punishmentWindowOpen) {
    return (
      <Box sx={{ mb: 3 }}>
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
      </Box>
    );
  }

  // 2. AUFGESCHOBENE STRAFE
  if (punishmentStatus.deferred) {
    return (
      <Box sx={{ mb: 3 }}>
         <Alert severity="warning" variant="filled" sx={{ py: 2, justifyContent: 'center', fontWeight: 'bold', bgcolor: `${PALETTE.accents.gold}22`, color: PALETTE.accents.gold, border: `1px solid ${PALETTE.accents.gold}` }}>
             STRAFE ({punishmentStatus.durationMinutes || '?'}m) AUFGESCHOBEN
         </Alert>
      </Box>
    );
  }

  // 3. AUDIT
  if (auditDue) {
    return (
      <Box sx={{ mb: 3 }}>
        <Button 
            variant="contained" fullWidth size="large"
            sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem', bgcolor: PALETTE.accents.gold, color: '#000' }} 
            startIcon={<GradingIcon />} 
            onClick={onStartAudit}
        >
           INVENTORY AUDIT FÄLLIG
        </Button>
      </Box>
    );
  }

  // 4. ANWEISUNG / FREI
  return (
    <Box sx={{ mb: 3 }}>
        <Button 
            variant="contained" fullWidth size="large" 
            aria-disabled={showFreeMode}
            sx={{ 
                py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                // Bedingtes Styling
                ...(!showFreeMode && (isNight || !currentInstruction) ? DESIGN_TOKENS.buttonGradient : {}),
                ...(showFreeMode ? { 
                    background: 'transparent', 
                    border: `1px solid ${PALETTE.text.muted}`,
                    color: PALETTE.text.muted 
                } : {}),
                
                transition: isHoldingOath ? 'background-color 5s linear' : 'all 0.2s'
            }} 
            onClick={onOpenInstruction} 
            startIcon={showFreeMode ? (freeDayReason === 'Holiday' ? <CelebrationIcon /> : <WeekendIcon />) : (isNight ? <DarkModeIcon /> : <LightModeIcon />)}
        >
            {showFreeMode
                ? (freeDayReason === 'Holiday' ? "FEIERTAG (FREI)" : "WOCHENENDE (FREI)") 
                : (isNight ? "NACHTANWEISUNG ÖFFNEN" : "TAGESANWEISUNG ÖFFNEN")
            }
        </Button>
    </Box>
  );
}