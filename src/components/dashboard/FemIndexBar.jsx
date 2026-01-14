import React from 'react';
import { Card, Box, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

export default function FemIndexBar({ femIndex, loading }) {
  const theme = useTheme();
  const m3 = theme.palette.m3;

  // M3 Tonal Logic: Farbe bestimmt sich durch den Status
  const getStatusColor = (value) => {
    if (value < 30) return m3.secondary; // Niedrig: Neutral/Blau (Secondary)
    if (value < 85) return m3.tertiary;  // Mittel: Fem/Pink (Tertiary)
    return m3.primary;                   // Hoch: System/Teal (Primary)
  };

  const activeColor = getStatusColor(femIndex);

  return (
    <Card sx={{ mb: 3, p: 2.5, position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {/* Icon Badge */}
                  <Box sx={{ 
                      bgcolor: activeColor + '22', // 12% Opacity
                      color: activeColor,
                      p: 0.8, borderRadius: '12px', display: 'flex'
                  }}>
                    <EmojiEventsIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Fem-Index
                  </Typography>
              </Box>
              
              <Typography variant="h6" sx={{ color: activeColor, fontWeight: 700, lineHeight: 1 }}>
                  {loading ? "--" : `${femIndex}`}
                  <Typography component="span" variant="caption" sx={{ color: theme.palette.text.secondary, ml: 0.5 }}>/ 100</Typography>
              </Typography>
          </Box>

          {/* M3 TRACK */}
          <Box sx={{ 
              height: 12, 
              bgcolor: m3.surfaceContainerHighest, 
              borderRadius: '9999px',
              overflow: 'hidden'
          }}>
              <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${femIndex}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  style={{
                      height: '100%',
                      backgroundColor: activeColor, // Solid Dynamic Color
                      borderRadius: '9999px',
                  }}
              />
          </Box>
    </Card>
  );
}