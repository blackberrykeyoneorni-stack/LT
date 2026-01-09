import React from 'react';
import { Box, Button, Alert } from '@mui/material';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import GradingIcon from '@mui/icons-material/Grading';
import CelebrationIcon from '@mui/icons-material/Celebration';
import WeekendIcon from '@mui/icons-material/Weekend';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';
import { isPunishmentWindowOpen } from '../../services/PunishmentService';

export default function ActionButtons({ 
  punishmentStatus, 
  auditDue, 
  isFreeDay, 
  freeDayReason, 
  currentInstruction, 
  currentPeriod, 
  isHoldingOath, 
  onStartPunishment, 
  onStartAudit, 
  onOpenInstruction 
}) {

  // Prüfen ob Straf-Fenster offen ist
  const punishmentWindowOpen = isPunishmentWindowOpen();

  // 1. STRAFE (Höchste Prio)
  if (punishmentStatus.active && punishmentWindowOpen) {
    return (
      <Box sx={{ mb: 3 }}>
        <Button 
            variant="contained" fullWidth size="large" color="error" 
            sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem' }} 
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
         <Alert severity="warning" sx={{ py: 2, justifyContent: 'center', fontWeight: 'bold' }}>
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
            variant="contained" fullWidth size="large" color="error" 
            sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem' }} 
            startIcon={<GradingIcon />} 
            onClick={onStartAudit}
        >
           INVENTORY AUDIT FÄLLIG
        </Button>
      </Box>
    );
  }

  // 4. ANWEISUNG ODER FREI
  // LOGIK-ANPASSUNG: Nachtanweisungen sind IMMER möglich, auch an Feiertagen.
  // "Frei" gilt nur, wenn es TAG ist und Feiertag.
  
  const instructionAlreadyStarted = currentInstruction && currentInstruction.isAccepted;
  const isNight = currentPeriod && currentPeriod.includes('night');
  
  // Zeige "Frei" nur an, wenn:
  // 1. Es ein Feiertag ist
  // 2. UND wir NICHT in der Nacht-Phase sind
  // 3. UND die Anweisung noch nicht gestartet wurde
  const showFreeMode = isFreeDay && !isNight && !instructionAlreadyStarted;

  return (
    <Box sx={{ mb: 3 }}>
        <Button 
            variant="contained" fullWidth size="large" 
            // UX-FIX: Button nicht deaktivieren, sondern nur semantisch markieren
            aria-disabled={showFreeMode}
            sx={{ 
                py: 2, fontWeight: 'bold', fontSize: '1.1rem',
                // Gradient nur wenn NICHT frei und (Nacht oder keine Anweisung geladen)
                ...(!showFreeMode && (isNight || !currentInstruction) ? DESIGN_TOKENS.buttonGradient : {}),
                
                // Grauer Style für Frei-Modus
                background: showFreeMode ? '#424242' : undefined,
                color: showFreeMode ? '#888' : '#000',
                
                boxShadow: '0 3px 5px 2px rgba(244, 143, 177, .3)',
                transition: isHoldingOath ? 'background-color 5s linear' : 'background-color 0.2s'
            }} 
            onClick={onOpenInstruction} 
            startIcon={
                showFreeMode
                ? (freeDayReason === 'Holiday' ? <CelebrationIcon /> : <WeekendIcon />) 
                : (isNight ? <DarkModeIcon /> : <LightModeIcon />)
            }
        >
            {showFreeMode
                ? (freeDayReason === 'Holiday' ? "FEIERTAG (FREI)" : "WOCHENENDE (FREI)") 
                : (isNight ? "NACHTANWEISUNG ÖFFNEN" : "TAGESANWEISUNG ÖFFNEN")
            }
        </Button>
    </Box>
  );
}
