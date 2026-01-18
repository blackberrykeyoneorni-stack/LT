import React from 'react';
import { Paper, Stack, Box, Typography, Chip, Button } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LockClockIcon from '@mui/icons-material/LockClock';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import { safeDate } from '../../utils/dateUtils';

export default function ActiveSessionsList({ 
  activeSessions, items, punishmentStatus, 
  onNavigateItem, onOpenRelease, onStopSession 
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
          <Paper sx={{ 
              p: 2, mb: 3, 
              ...DESIGN_TOKENS.glassCard,
              borderColor: PALETTE.accents.pink, 
              background: `linear-gradient(180deg, ${PALETTE.accents.pink}15 0%, rgba(0,0,0,0) 100%)`
          }}>
              <Stack spacing={2}>
                  {activeSessions.map(s => {
                      const item = items.find(i => i.id === s.itemId);
                      const startTime = safeDate(s.startTime);
                      const elapsed = Math.floor((now - startTime.getTime())/60000);
                      const isPunishment = s.type === 'punishment';
                      const durationLabel = isPunishment ? `${elapsed}m / ${punishmentStatus.durationMinutes || '?'}m` : formatMinutes(elapsed);

                      return item ? (
                          <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                    textDecoration: 'underline', 
                                    textDecorationColor: PALETTE.accents.pink, 
                                    cursor: 'pointer',
                                    color: PALETTE.text.primary
                                }} 
                                onClick={() => onNavigateItem(item.id)}
                              >
                                {item.name || item.brand} {item.subCategory ? `(${item.subCategory})` : ''}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip 
                                      label={durationLabel} 
                                      size="small"
                                      sx={{ 
                                          bgcolor: isPunishment ? `${PALETTE.accents.red}33` : `${PALETTE.primary.main}33`, 
                                          color: isPunishment ? PALETTE.accents.red : PALETTE.primary.main,
                                          border: `1px solid ${isPunishment ? PALETTE.accents.red : PALETTE.primary.main}`
                                      }}
                                      icon={isPunishment ? <AccessTimeIcon style={{fontSize:16}}/> : null} 
                                  />
                                  <Button 
                                      variant="outlined" size="small" 
                                      color={isPunishment ? 'error' : 'secondary'} 
                                      startIcon={isPunishment ? <LockClockIcon /> : <StopCircleIcon />} 
                                      onClick={() => onStopSession(s)}
                                      sx={{ borderRadius: 8 }}
                                  >
                                      Stop
                                  </Button>
                              </Stack>
                          </Box>
                      ) : null;
                  })}

                  {!activeSessions.some(s => s.type === 'punishment') && (
                      <Button
                          variant="outlined" fullWidth
                          onClick={() => onOpenRelease(activeSessions)}
                          sx={{ 
                              mt: 1, py: 1.5, 
                              borderColor: PALETTE.accents.blue, 
                              color: PALETTE.accents.blue,
                              fontWeight: 'bold', letterSpacing: '1px',
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
    </>
  );
}