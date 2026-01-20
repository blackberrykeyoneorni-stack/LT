import React from 'react';
import { Box, Typography, LinearProgress, Paper } from '@mui/material';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function ProgressBar({ currentMinutes, targetHours, isGoalMetToday, progressData }) {
    
    const targetMinutes = targetHours * 60;
    // Balken darf max 100% sein, aber Text zeigt echte Werte
    const progressPercent = Math.min(100, Math.max(0, (currentMinutes / targetMinutes) * 100));
    
    // Logik für Farben und Icons
    const barColor = isGoalMetToday ? PALETTE.accents.green : PALETTE.primary.main;
    const nightSuccess = progressData?.nightCompliance === true;

    const formatTime = (totalMins) => {
        const h = Math.floor(totalMins / 60);
        const m = Math.floor(totalMins % 60);
        return `${h}h ${m}m`;
    };

    return (
        <Box sx={{ mb: 4, width: '100%' }}>
            {/* Header Zeile: Titel und Zeit */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Tagesziel
                </Typography>
                <Typography variant="h6" sx={{ color: isGoalMetToday ? PALETTE.accents.green : 'text.secondary' }}>
                    {formatTime(currentMinutes)} <Typography component="span" variant="body2" color="text.secondary">/ {targetHours}h</Typography>
                </Typography>
            </Box>

            {/* Der Balken - Schlicht und flach */}
            <LinearProgress 
                variant="determinate" 
                value={progressPercent} 
                sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                        backgroundColor: barColor,
                        borderRadius: 5
                    }
                }}
            />

            {/* Status Zeile: Mond Anzeige */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, alignItems: 'center', gap: 1 }}>
                <NightlightRoundIcon sx={{ 
                    fontSize: 18, 
                    color: nightSuccess ? PALETTE.accents.gold : 'text.disabled' 
                }} />
                <Typography variant="caption" sx={{ 
                    color: nightSuccess ? PALETTE.accents.gold : 'text.disabled',
                    fontWeight: nightSuccess ? 'bold' : 'normal',
                    textTransform: 'uppercase'
                }}>
                    {nightSuccess ? "Nacht erfüllt" : "Nacht offen"}
                </Typography>
            </Box>
        </Box>
    );
}