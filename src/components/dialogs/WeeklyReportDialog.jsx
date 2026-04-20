import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Typography, 
  Box, 
  Button,
  Divider
} from '@mui/material';
import { PALETTE } from '../../theme/obsidianDesign';

export default function WeeklyReportDialog({ open, onClose, report }) {
  if (!report) return null;

  const formatMins = (m) => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backgroundImage: 'none',
          border: `1px solid ${PALETTE.accents.gold}40`,
          borderRadius: '16px',
          maxWidth: '400px'
        }
      }}
    >
      <DialogTitle sx={{ color: PALETTE.accents.gold, textAlign: 'center', fontWeight: 'bold' }}>
        WÖCHENTLICHER COMPLIANCE-AUDIT
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: '#aaa', mb: 2, textAlign: 'center' }}>
            Audit der Werktage (Mo-Fr):
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {report.dailyAudit && report.dailyAudit.map((dayData, idx) => (
              <Box key={idx} sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                p: 1,
                bgcolor: dayData.isSick ? 'rgba(211, 47, 47, 0.05)' : 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                borderLeft: dayData.isSick ? `3px solid ${PALETTE.accents.red}` : 'none'
              }}>
                <Typography sx={{ color: '#fff', fontSize: '0.9rem' }}>{dayData.day}:</Typography>
                <Typography sx={{ 
                  color: dayData.isSick ? PALETTE.accents.red : (dayData.minutes >= report.oldTarget ? PALETTE.accents.gold : '#777'),
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  {dayData.isSick ? "FREIGESTELLT (Krankheit)" : formatMins(dayData.minutes)}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ bgcolor: `${PALETTE.accents.gold}20`, my: 2 }} />

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mt: 1,
            p: 1.5,
            border: `1px dashed ${PALETTE.accents.gold}60`,
            borderRadius: '8px',
            bgcolor: report.isEscalated ? 'rgba(212, 175, 55, 0.05)' : 'transparent'
          }}>
            <Typography sx={{ color: PALETTE.accents.gold, fontWeight: 'bold' }}>
              NEUE VORGABE:
            </Typography>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
              {formatMins(report.newTarget)} / Tag
            </Typography>
          </Box>
        </Box>

        <Typography variant="body2" sx={{ 
          color: report.isEscalated ? PALETTE.accents.gold : '#aaa', 
          textAlign: 'center',
          fontStyle: 'italic',
          mt: 2
        }}>
          {report.isEscalated 
            ? "Deine erbrachte Leistung übersteigt die Forderung. Das System eskaliert die Zielvorgabe permanent." 
            : "Die Forderung wurde nicht überboten oder unterschritten. Die Zielvorgabe stagniert auf dem aktuellen Niveau."}
        </Typography>
        
        {report.newTarget >= 720 && (
          <Typography variant="caption" sx={{ color: PALETTE.accents.red, display: 'block', textAlign: 'center', mt: 1, fontWeight: 'bold' }}>
            MAXIMALES KONDITIONIERUNGS-LEVEL ERREICHT (12H CAP)
          </Typography>
        )}
      </DialogContent>

      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Button 
          fullWidth
          onClick={onClose}
          sx={{ 
            color: PALETTE.accents.gold, 
            borderColor: PALETTE.accents.gold,
            '&:hover': { bgcolor: 'rgba(212, 175, 55, 0.1)' }
          }} 
          variant="outlined"
        >
          ICH AKZEPTIERE MEINE BESTIMMUNG
        </Button>
      </Box>
    </Dialog>
  );
}