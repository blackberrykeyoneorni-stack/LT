import React from 'react';
import { Paper, Stack, Box, Typography, Chip, Button } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LockClockIcon from '@mui/icons-material/LockClock';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import { PALETTE } from '../../theme/obsidianDesign';

// CRASH-FIX: Helper für sicheres Datumsparsen
const safeDate = (val) => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate();
    return new Date(val);
};

export default function ActiveSessionsList({ 
  activeSessions, 
  items, 
  punishmentStatus, 
  washingItemsCount, 
  onNavigateItem, 
  onOpenRelease, 
  onStopSession, 
  onOpenLaundry 
}) {

  const formatMinutes = (min) => {
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    return `${h}h ${m}m`;
  };
  const now = Date.now();

  return (
    <>
      {activeSessions.length > 0 && (
          <Paper sx={{ p: 2, mb: 3, border: `1px solid ${PALETTE.accents.pink}`, background: `${PALETTE.accents.pink}10` }}>
              <Stack spacing={2}>
                  {activeSessions.map(s => {
                      const item = items.find(i => i.id === s.itemId);
                      
                      // CRASH-FIX: Verwendung von safeDate
                      const startTime = safeDate(s.startTime);
                      const elapsed = Math.floor((now - startTime.getTime())/60000);
                      
                      const isPunishment = s.type === 'punishment';
                      const durationLabel = isPunishment ? `${elapsed}m / ${punishmentStatus.durationMinutes || '?'}m` : formatMinutes(elapsed);

                      return item ? (
                          <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="body1" 
                                sx={{ textDecoration: 'underline', textDecorationColor: PALETTE.accents.pink, cursor: 'pointer' }} 
                                onClick={() => onNavigateItem(item.id)}
                              >
                                {item.name || item.brand}{item.subCategory ? ` (${item.subCategory})` : ''}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip 
                                      label={durationLabel} 
                                      color={isPunishment ? "error" : "primary"} 
                                      icon={isPunishment ? <AccessTimeIcon style={{fontSize:16}}/> : null} 
                                  />
                                  <Button 
                                      variant="contained" size="small" 
                                      color={isPunishment ? 'error' : 'secondary'} 
                                      startIcon={isPunishment ? <LockClockIcon /> : <StopCircleIcon />} 
                                      onClick={() => onStopSession(s)}
                                  >
                                      Stop
                                  </Button>
                              </Stack>
                          </Box>
                      ) : null;
                  })}

                  {/* GLOBALER ENTLADUNGS-BALKEN */}
                  {!activeSessions.some(s => s.type === 'punishment') && (
                      <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => onOpenRelease(activeSessions)}
                          sx={{ 
                              mt: 1, 
                              py: 1.5, 
                              borderColor: PALETTE.accents.blue, 
                              color: PALETTE.accents.blue,
                              fontWeight: 'bold',
                              letterSpacing: '1px',
                              background: `${PALETTE.accents.blue}08`,
                              '&:hover': { background: `${PALETTE.accents.blue}15`, borderColor: PALETTE.accents.blue }
                          }}
                          startIcon={<WaterDropIcon />}
                      >
                          SPERMA ENTLADUNG
                      </Button>
                  )}
              </Stack>
          </Paper>
      )}

      {washingItemsCount > 0 && (
          <Paper 
            sx={{ p: 2, mb: 3, bgcolor: `${PALETTE.accents.blue}1A`, border: `1px solid ${PALETTE.accents.blue}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={onOpenLaundry}
          >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <LocalLaundryServiceIcon color="info" />
                  <Typography variant="subtitle1" fontWeight="bold">Wäschekorb</Typography>
              </Box>
              <Chip label={`${washingItemsCount} Stk.`} color="info" size="small" />
          </Paper>
      )}
    </>
  );
}
