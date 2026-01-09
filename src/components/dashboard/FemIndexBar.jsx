import React from 'react';
import { Paper, Box, Typography, LinearProgress, useTheme } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export default function FemIndexBar({ femIndex, loading }) {
  const theme = useTheme(); // Zugriff auf das aktive Theme (sicher)
  
  // Wir holen die Farben aus dem Theme-Objekt
  // Fallback-Werte ('#...') dienen als doppelte Absicherung
  const secondaryColor = theme.palette.secondary.main || '#546E7A';
  const primaryColor = theme.palette.primary.main || '#E6C2BF';
  // accents greifen wir nun auch über das Theme ab (siehe obsidianDesign.js Änderung)
  const pinkColor = theme.palette.accents?.pink || '#f48fb1';
  const glassColor = theme.palette.background.glass || 'rgba(255, 255, 255, 0.03)';

  const getBarColor = (value) => {
    if (value < 30) return secondaryColor;
    if (value < 85) return pinkColor; 
    return primaryColor; 
  };

  const currentColor = getBarColor(femIndex);

  return (
    <Paper sx={{ 
        p: 2, mb: 3, 
        border: '1px solid', 
        borderColor: femIndex > 90 ? primaryColor : `${pinkColor}4D`,
        boxShadow: femIndex > 90 ? `0 0 20px ${primaryColor}4D` : 'none',
        bgcolor: glassColor
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
                    background: `linear-gradient(90deg, ${secondaryColor} 0%, ${pinkColor} 50%, ${primaryColor} 100%)`
                  }
              }} 
          />
    </Paper>
  );
}
