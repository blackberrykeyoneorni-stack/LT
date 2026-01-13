import React from 'react';
import { Paper, Box, Typography, LinearProgress } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function FemIndexBar({ femIndex, loading }) {
  const getBarColor = (value) => {
    if (value < 30) return PALETTE.secondary.main;
    if (value < 85) return PALETTE.accents.pink; 
    return PALETTE.primary.main; 
  };

  const currentColor = getBarColor(femIndex);

  return (
    <Paper sx={{ 
        p: 2, mb: 3, 
        ...DESIGN_TOKENS.glassCard,
        border: '1px solid', 
        borderColor: femIndex > 90 ? PALETTE.primary.main : `${PALETTE.accents.pink}4D`,
        boxShadow: femIndex > 90 ? `0 0 20px ${PALETTE.primary.main}4D` : 'none',
    }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEventsIcon sx={{ color: currentColor, fontSize: '1rem' }} /> Fem-Index
              </Typography>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ color: currentColor }}>
                  {loading ? "..." : `${femIndex}%`}
              </Typography>
          </Box>

          <LinearProgress 
              variant="determinate" 
              value={femIndex} 
              sx={{ 
                  height: 10, 
                  borderRadius: 5, 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${PALETTE.secondary.main} 0%, ${PALETTE.accents.pink} 50%, ${PALETTE.primary.main} 100%)`
                  }
              }} 
          />
    </Paper>
  );
}